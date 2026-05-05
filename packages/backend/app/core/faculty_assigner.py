"""
faculty_assigner.py
────────────────────────────────────────────────────────────────────────────────
Greedy post-solve faculty assignment.

After CP-SAT has placed every session in its time/room slot this module
assigns the best-qualified available faculty member to each event while
enforcing:

  • Specialization gate      – faculty.specializations must contain the courseCode
  • Tiered unit cap          – from unit_balancing.compute_effective_max_units()
  • Double-booking guard     – no faculty in two time-overlapping slots
  • Section consistency      – ALL sessions (lecture + lab, across all days)
                               of the same (program, courseCode, block) go to
                               the same instructor
  • Merged-block consistency – merged blocks (e.g. 5-A / 5-B) → same instructor
                               for the shared lecture AND for each block's lab
  • Backtracking safety net  – a second pass attempts to resolve TBA groups
                               that the greedy pass could not satisfy

Integration
───────────
Call assign() BEFORE the internal '_start_slot'/'_duration' keys are stripped
from events (i.e. right after HierarchicalScheduler.solve() returns).

  assigner = FacultyAssigner()
  assigner.load_faculty()
  schedule = assigner.assign(schedule)   # mutates events in-place; returns same list
"""

from __future__ import annotations

import logging
import re
from collections import defaultdict
from typing import Any

from app.core.firebase import db
from app.core.unit_balancing import compute_effective_max_units

logger = logging.getLogger("faculty_assigner")

# ── Tuneable weights ──────────────────────────────────────────────────────────
W_SPEC_RATING   = 100   # Specialization rating (1-5)
W_HEADROOM      =  10   # Remaining unit capacity
W_FULLTIME      =  20   # Prefer full-time over part-time
W_PREF_DAY      =   5   # Day falls within preferredDays
W_PREF_TIME     =   5   # Session fits within preferred time window
W_LOW_LOAD      =   8   # Favour less-loaded faculty (load balancing)
W_CONTINUITY    =  50   # Bonus for already teaching same courseCode to another block

# Slots run at 0.5 hr each, starting at 7:00 AM
SLOT_START_HOUR = 7.0
SLOT_INCREMENT  = 0.5


# ─────────────────────────────────────────────────────────────────────────────
class FacultyAssigner:
    # ── Initialisation ────────────────────────────────────────────────────────

    def __init__(self) -> None:
        self.faculty_list: list[dict] = []

        # Runtime tracking (reset on each assign() call)
        self._assigned_units:  dict[str, float]      = {}   # name → hours used
        self._faculty_courses: dict[str, set[str]]   = defaultdict(set)
        self._faculty_slots:   dict[str, list[tuple]] = defaultdict(list)

    # ── Data loading ──────────────────────────────────────────────────────────

    def load_faculty(self) -> None:
        """Pull all non-archived faculty from Firestore."""
        docs = db.collection("faculty").where("archived", "==", False).stream()
        self.faculty_list = []
        for d in docs:
            data = d.to_dict()
            if data:
                self.faculty_list.append(data)

        logger.info("FacultyAssigner: loaded %d active faculty", len(self.faculty_list))

    def _reset_tracking(self) -> None:
        self._assigned_units  = {f["name"]: 0.0 for f in self.faculty_list}
        self._faculty_courses = defaultdict(set)
        self._faculty_slots   = defaultdict(list)

    # ── Conflict helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _overlaps(occupied: list[tuple[int, int]], s: int, e: int) -> bool:
        """True when [s, e) overlaps any interval in occupied."""
        for (os, oe) in occupied:
            if s < oe and e > os:
                return True
        return False

    def _reserve(self, name: str, start: int, duration: int) -> None:
        self._faculty_slots[name].append((start, start + duration))

    def _unreserve(self, name: str, start: int, duration: int) -> None:
        """Remove a previously reserved slot (for backtracking)."""
        pair = (start, start + duration)
        try:
            self._faculty_slots[name].remove(pair)
        except ValueError:
            pass

    # ── Eligibility ───────────────────────────────────────────────────────────

    def _has_specialization(self, faculty: dict, course_code: str) -> bool:
        return any(
            s.get("courseCode", "").upper() == course_code.upper()
            for s in faculty.get("specializations", [])
        )

    def _spec_rating(self, faculty: dict, course_code: str) -> int:
        for s in faculty.get("specializations", []):
            if s.get("courseCode", "").upper() == course_code.upper():
                return int(s.get("rating", 1))
        return 0

    def _current_max(self, faculty: dict) -> float:
        name   = faculty["name"]
        status = faculty.get("status", "full-time")
        return compute_effective_max_units(
            status,
            len(self._faculty_courses[name]),
        )

    def _is_eligible(
        self,
        faculty: dict,
        course_code: str,
        start_slot:  int | None,
        duration:    int | None,
        unit_cost:   float,
    ) -> bool:
        name = faculty["name"]

        # Gate 1 – specialization
        if not self._has_specialization(faculty, course_code):
            return False

        # Gate 2 – unit headroom
        effective_max = self._current_max(faculty)
        used          = self._assigned_units.get(name, 0.0)
        # Part-time gets a small emergency valve (mirrors unit_balancing logic)
        buffer = 3.0 if faculty.get("status", "full-time").lower() == "part-time" else 0.0
        if used + unit_cost > effective_max + buffer:
            return False

        # Gate 3 – no time conflict
        if start_slot is not None and duration is not None:
            if self._overlaps(self._faculty_slots[name], start_slot, start_slot + duration):
                return False

        return True

    # ── Scoring ───────────────────────────────────────────────────────────────

    def _score(
        self,
        faculty:     dict,
        course_code: str,
        events:      list[dict],
    ) -> float:
        """
        Score a faculty candidate against an entire group of events.

        The score combines static factors (specialization, headroom, employment
        type) with per-event preference matching (preferred days and time
        windows), aggregated across ALL events in the group.
        """
        name   = faculty["name"]
        status = faculty.get("status", "full-time").lower()
        score  = 0.0

        # ── Static factors ────────────────────────────────────────────────────
        # Specialization quality
        score += self._spec_rating(faculty, course_code) * W_SPEC_RATING

        # Remaining headroom (load balancing)
        effective_max = self._current_max(faculty)
        used          = self._assigned_units.get(name, 0.0)
        score += (effective_max - used) * W_HEADROOM

        # Load balance nudge – favour less-loaded faculty among equals
        score -= used * W_LOW_LOAD

        # Employment type preference
        if status == "full-time":
            score += W_FULLTIME

        # Continuity bonus – already teaching this courseCode to another block
        if course_code.upper() in self._faculty_courses.get(name, set()):
            score += W_CONTINUITY

        # ── Per-event preference factors ──────────────────────────────────────
        preferred_days = faculty.get("preferredDays", [])
        pref_start     = float(faculty.get("preferredTimeStart", SLOT_START_HOUR))
        pref_end       = float(faculty.get("preferredTimeEnd", 21.0))
        slots_per_day  = 28  # (21 - 7) / 0.5

        day_hits  = 0
        time_hits = 0
        n_events  = len(events) or 1

        for ev in events:
            # Preferred day
            if preferred_days and ev.get("day") in preferred_days:
                day_hits += 1

            # Preferred time window
            start_slot = ev.get("_start_slot")
            ev_units   = float(ev.get("units", 0))
            if start_slot is not None and ev_units:
                local_slot    = start_slot % slots_per_day
                ev_start_hour = SLOT_START_HOUR + local_slot * SLOT_INCREMENT
                ev_end_hour   = ev_start_hour + ev_units
                if ev_start_hour >= pref_start and ev_end_hour <= pref_end:
                    time_hits += 1

        # Scale proportionally: more matched events → higher bonus
        score += day_hits  * W_PREF_DAY
        score += time_hits * W_PREF_TIME

        return score

    # ── Grouping ──────────────────────────────────────────────────────────────

    def _group_events(self, schedule: list[dict]) -> list[list[dict]]:
        """
        Group events that must share the same faculty.

        Group key rules
        ───────────────
        section  – keyed by (program, courseCode, block)
                   → covers BOTH lecture and lab of the same section/block,
                   including split lectures across multiple days.

        merged   – schedule_id looks like "<num>-A" or "<num>-B"
                   → all events with the same numeric base are merged.
                   The merged blocks' OTHER sessions (labs) are also
                   linked into one super-group so all merged blocks
                   share the same faculty for everything.
        """
        groups: dict[str, list[dict]] = defaultdict(list)

        # First pass: identify which blocks are merged together
        # merge_base_id → set of (program, courseCode, block) section keys
        merged_sections: dict[str, set[str]] = defaultdict(set)

        for ev in schedule:
            sid  = str(ev.get("schedule_id", ""))
            m = re.match(r'^(\d+)-[A-Z]$', sid)
            if m:
                merge_base = m.group(1)
                code = ev.get("courseCode", "")
                blk  = ev.get("block", "")
                prog = ev.get("program", "")
                section_key = f"section_{prog}_{code}_{blk}"
                merged_sections[merge_base].add(section_key)

        # Build a mapping: section_key → canonical group key
        # For merged blocks, all their section keys map to the same canonical key
        section_to_canonical: dict[str, str] = {}
        for merge_base, section_keys in merged_sections.items():
            # Use the lexicographically first section key as the canonical one
            canonical = sorted(section_keys)[0]
            for sk in section_keys:
                # Only override if not already mapped to something else
                if sk in section_to_canonical:
                    # If already mapped, unify: point the new canonical to the old
                    existing = section_to_canonical[sk]
                    # Update all that point to `canonical` to point to `existing`
                    if existing != canonical:
                        target = min(existing, canonical)
                        other  = max(existing, canonical)
                        for k, v in section_to_canonical.items():
                            if v == other:
                                section_to_canonical[k] = target
                        canonical = target
                else:
                    section_to_canonical[sk] = canonical

        # Second pass: assign every event to its group
        for ev in schedule:
            code = ev.get("courseCode", "")
            blk  = ev.get("block", "")
            prog = ev.get("program", "")
            section_key = f"section_{prog}_{code}_{blk}"

            # Resolve to canonical key (handles merged blocks)
            group_key = section_to_canonical.get(section_key, section_key)
            groups[group_key].append(ev)

        return list(groups.values())

    # ── Assignment ────────────────────────────────────────────────────────────

    def _unique_slots(self, events: list[dict]) -> list[tuple[int, int]]:
        """
        Return de-duplicated (start_slot, duration) pairs.
        Merged events share the same slot; we must not double-count it.
        """
        seen: set[tuple[int, int]] = set()
        result = []
        for ev in events:
            s = ev.get("_start_slot")
            d = ev.get("_duration")
            if s is not None and d is not None:
                key = (s, d)
                if key not in seen:
                    seen.add(key)
                    result.append(key)
        return result

    def _total_unit_cost(self, events: list[dict]) -> float:
        """
        Unit cost for a group = sum of units for UNIQUE slots only.
        (Merged blocks teach one session that two blocks attend; count once.)
        """
        seen_slots: set[tuple] = set()
        total = 0.0
        for ev in events:
            s = ev.get("_start_slot")
            d = ev.get("_duration")
            key = (s, d)
            if key not in seen_slots:
                seen_slots.add(key)
                total += float(ev.get("units", 0))
        return total

    def _find_best(
        self,
        course_code: str,
        events:      list[dict],
    ) -> str | None:
        """
        Return the name of the highest-scoring eligible faculty member,
        or None if nobody is available.
        """
        # Build the set of distinct slots this group requires
        unique_slots = self._unique_slots(events)
        unit_cost    = self._total_unit_cost(events)

        candidates: list[tuple[float, str]] = []
        for faculty in self.faculty_list:
            # Check against every distinct time slot the group occupies
            eligible = True
            for (start, dur) in unique_slots:
                if not self._is_eligible(faculty, course_code, start, dur, unit_cost):
                    eligible = False
                    break
            if eligible:
                score = self._score(faculty, course_code, events)
                candidates.append((score, faculty["name"]))

        if not candidates:
            return None

        candidates.sort(reverse=True)
        return candidates[0][1]

    def _apply_assignment(
        self,
        faculty_name: str,
        course_code:  str,
        events:       list[dict],
    ) -> None:
        """Mutate events with the assignment and update all tracking state."""
        fac_obj = next(f for f in self.faculty_list if f["name"] == faculty_name)

        # Compute the group-level score once
        group_score = round(self._score(fac_obj, course_code, events), 2)

        # Mark each event
        for ev in events:
            ev["faculty"]             = faculty_name
            ev["facultyAutoAssigned"] = True
            ev["assignmentScore"]     = group_score

        # Reserve unique time slots (avoid double-counting for merged blocks)
        for (start, dur) in self._unique_slots(events):
            self._reserve(faculty_name, start, dur)

        # Deduct unit cost once
        cost = self._total_unit_cost(events)
        self._assigned_units[faculty_name] = (
            self._assigned_units.get(faculty_name, 0.0) + cost
        )

        # Track distinct courses
        self._faculty_courses[faculty_name].add(course_code.upper())

    def _undo_assignment(
        self,
        faculty_name: str,
        course_code:  str,
        events:       list[dict],
    ) -> None:
        """Reverse a previous _apply_assignment (for backtracking)."""
        # Un-reserve unique time slots
        for (start, dur) in self._unique_slots(events):
            self._unreserve(faculty_name, start, dur)

        # Return unit cost
        cost = self._total_unit_cost(events)
        self._assigned_units[faculty_name] = max(
            0.0, self._assigned_units.get(faculty_name, 0.0) - cost
        )

        # Remove course tracking (only if no other events for this course remain)
        # We leave it in _faculty_courses since removing it could be incorrect
        # if the faculty teaches other blocks of the same course.

        # Clear event fields
        for ev in events:
            ev["faculty"]             = "TBA"
            ev["facultyAutoAssigned"] = False
            ev["assignmentScore"]     = None

    def _mark_tba(self, events: list[dict], course_code: str) -> None:
        for ev in events:
            ev["faculty"]             = "TBA"
            ev["facultyAutoAssigned"] = False
            ev["assignmentScore"]     = None

    # ── Backtracking ──────────────────────────────────────────────────────────

    def _backtrack_tba_groups(
        self,
        tba_groups:  list[list[dict]],
        all_groups:  list[list[dict]],
    ) -> list[list[dict]]:
        """
        Attempt to resolve TBA groups by finding faculty who could serve them
        if a conflicting earlier assignment were swapped to an alternative.

        Returns the list of groups that remain TBA after backtracking.
        """
        if not tba_groups:
            return []

        remaining_tba: list[list[dict]] = []

        for tba_group in tba_groups:
            code = tba_group[0].get("courseCode", "")
            tba_unique_slots = self._unique_slots(tba_group)
            tba_unit_cost    = self._total_unit_cost(tba_group)
            resolved = False

            # Find faculty with the right specialization
            for faculty in self.faculty_list:
                if not self._has_specialization(faculty, code):
                    continue
                name = faculty["name"]

                # Check unit headroom
                effective_max = self._current_max(faculty)
                used = self._assigned_units.get(name, 0.0)
                buffer = 3.0 if faculty.get("status", "full-time").lower() == "part-time" else 0.0
                if used + tba_unit_cost > effective_max + buffer:
                    continue

                # Find which of this faculty's current slots conflict
                conflicting_slots = []
                for (start, dur) in tba_unique_slots:
                    if self._overlaps(self._faculty_slots[name], start, start + dur):
                        conflicting_slots.append((start, dur))

                if not conflicting_slots:
                    # No time conflict — this faculty is actually eligible!
                    # (This shouldn't normally happen since _find_best already
                    # checked, but can occur after other backtracking changes.)
                    self._apply_assignment(name, code, tba_group)
                    resolved = True
                    logger.info(
                        "Backtrack: resolved TBA %s block %s → %s (no conflict)",
                        code, tba_group[0].get("block", "?"), name,
                    )
                    break

                # Identify which assigned groups are causing the conflict
                blocking_groups: list[list[dict]] = []
                for group in all_groups:
                    if group is tba_group:
                        continue
                    if group[0].get("faculty") != name:
                        continue
                    group_slots = self._unique_slots(group)
                    for (gs, gd) in group_slots:
                        for (cs, cd) in conflicting_slots:
                            if cs < gs + gd and cs + cd > gs:
                                blocking_groups.append(group)
                                break
                        else:
                            continue
                        break

                if not blocking_groups:
                    continue

                # Try to reassign each blocking group to an alternative faculty
                all_swappable = True
                swap_plan: list[tuple[list[dict], str, str]] = []  # (group, old_name, new_name)

                for bg in blocking_groups:
                    bg_code = bg[0].get("courseCode", "")
                    bg_old_faculty = bg[0].get("faculty", "")

                    # Temporarily undo this assignment to free the slot
                    self._undo_assignment(bg_old_faculty, bg_code, bg)

                    # Find alternative faculty for this blocking group
                    alt = self._find_best(bg_code, bg)
                    if alt and alt != name:
                        swap_plan.append((bg, bg_old_faculty, alt))
                    else:
                        # Can't swap this one — restore and abort
                        self._apply_assignment(bg_old_faculty, bg_code, bg)
                        all_swappable = False
                        # Restore any already-undone swaps
                        for (sg, so, _sn) in swap_plan:
                            self._apply_assignment(so, sg[0].get("courseCode", ""), sg)
                        swap_plan.clear()
                        break

                if all_swappable and swap_plan:
                    # Execute all swaps
                    for (sg, _so, sn) in swap_plan:
                        sg_code = sg[0].get("courseCode", "")
                        self._apply_assignment(sn, sg_code, sg)
                        logger.info(
                            "Backtrack: swapped %s block %s: %s → %s",
                            sg_code, sg[0].get("block", "?"), _so, sn,
                        )

                    # Now assign the TBA group to the freed faculty
                    self._apply_assignment(name, code, tba_group)
                    resolved = True
                    logger.info(
                        "Backtrack: resolved TBA %s block %s → %s",
                        code, tba_group[0].get("block", "?"), name,
                    )
                    break

            if not resolved:
                remaining_tba.append(tba_group)

        return remaining_tba

    # ── Public API ────────────────────────────────────────────────────────────

    def assign(self, schedule: list[dict]) -> list[dict]:
        """
        Assign faculty to every event.

        Call this BEFORE stripping the internal '_start_slot'/'_duration' keys.

        Parameters
        ----------
        schedule : list[dict]
            Output of HierarchicalScheduler.solve() — events still contain
            '_start_slot', '_duration', '_room_type', '_room_idx'.

        Returns
        -------
        The same list, mutated in-place, with 'faculty', 'facultyAutoAssigned',
        and 'assignmentScore' fields added to every event.
        """
        if not self.faculty_list:
            logger.warning("FacultyAssigner.assign() called before load_faculty(); loading now.")
            self.load_faculty()

        self._reset_tracking()
        groups = self._group_events(schedule)

        logger.info(
            "FacultyAssigner: %d events → %d groups (sections)",
            len(schedule), len(groups),
        )

        # Log group composition for debugging
        for group in groups:
            codes   = set(ev.get("courseCode", "") for ev in group)
            blocks  = set(ev.get("block", "") for ev in group)
            types   = set(ev.get("session", "") or ev.get("_room_type", "") for ev in group)
            logger.debug(
                "  Group: %s block(s) %s | %d events | types: %s",
                codes, blocks, len(group), types,
            )

        # ── Sort groups: fewest qualified faculty first (hardest to satisfy) ──
        def _rarity(group: list[dict]) -> tuple[int, int]:
            code = group[0].get("courseCode", "")
            qualified_count = sum(
                1 for f in self.faculty_list
                if self._has_specialization(f, code)
            )
            # Secondary sort: larger groups (more slots) are harder to satisfy
            return (qualified_count, -len(self._unique_slots(group)))

        groups.sort(key=_rarity)

        tba_groups: list[list[dict]] = []

        for group in groups:
            code = group[0].get("courseCode", "")
            best = self._find_best(code, group)

            if best:
                self._apply_assignment(best, code, group)
                blocks = sorted(set(ev.get("block", "?") for ev in group))
                logger.debug(
                    "Assigned %s → %s (block(s) %s, %d events)",
                    best, code, blocks, len(group),
                )
            else:
                self._mark_tba(group, code)
                tba_groups.append(group)
                blocks = sorted(set(ev.get("block", "?") for ev in group))
                logger.warning(
                    "TBA (greedy): no eligible faculty for %s block(s) %s (%d events)",
                    code, blocks, len(group),
                )

        # ── Backtracking pass ─────────────────────────────────────────────────
        if tba_groups:
            logger.info(
                "Starting backtracking pass for %d TBA group(s)…",
                len(tba_groups),
            )
            tba_groups = self._backtrack_tba_groups(tba_groups, groups)

        # ── Final summary ─────────────────────────────────────────────────────
        if tba_groups:
            tba_codes = sorted(set(
                g[0].get("courseCode", "") for g in tba_groups
            ))
            logger.warning("Assignment complete. TBA courses: %s", tba_codes)
        else:
            logger.info("Assignment complete. All sessions assigned successfully.")

        # ── Consistency validation ────────────────────────────────────────────
        self._validate_consistency(schedule)

        return schedule

    # ── Validation ────────────────────────────────────────────────────────────

    def _validate_consistency(self, schedule: list[dict]) -> None:
        """
        Post-assignment validation: log warnings for any inconsistencies.
        """
        # Check 1: Same (program, courseCode, block) → same faculty
        section_faculty: dict[tuple, set[str]] = defaultdict(set)
        for ev in schedule:
            key = (ev.get("program", ""), ev.get("courseCode", ""), ev.get("block", ""))
            fac = ev.get("faculty", "TBA")
            if fac != "TBA":
                section_faculty[key].add(fac)

        for key, faculties in section_faculty.items():
            if len(faculties) > 1:
                logger.error(
                    "CONSISTENCY ERROR: Section %s has multiple faculty: %s",
                    key, faculties,
                )

        # Check 2: No faculty time conflicts
        faculty_intervals: dict[str, list[tuple[int, int, dict]]] = defaultdict(list)
        for ev in schedule:
            fac   = ev.get("faculty", "TBA")
            start = ev.get("_start_slot")
            dur   = ev.get("_duration")
            if fac != "TBA" and start is not None and dur is not None:
                faculty_intervals[fac].append((start, start + dur, ev))

        for fac, intervals in faculty_intervals.items():
            # De-duplicate (merged blocks share the same physical slot)
            seen_slots: set[tuple[int, int]] = set()
            unique_intervals: list[tuple[int, int, dict]] = []
            for (s, e, ev) in intervals:
                if (s, e) not in seen_slots:
                    seen_slots.add((s, e))
                    unique_intervals.append((s, e, ev))

            unique_intervals.sort()
            for i in range(len(unique_intervals) - 1):
                s1, e1, ev1 = unique_intervals[i]
                s2, e2, ev2 = unique_intervals[i + 1]
                if s2 < e1:
                    logger.error(
                        "TIME CONFLICT: %s double-booked: %s (%s) slots [%d-%d) "
                        "overlaps %s (%s) slots [%d-%d)",
                        fac,
                        ev1.get("courseCode"), ev1.get("block"), s1, e1,
                        ev2.get("courseCode"), ev2.get("block"), s2, e2,
                    )

    # ── Diagnostic helper (optional) ─────────────────────────────────────────

    def load_summary(self) -> list[dict]:
        """
        Return a list of dicts summarising each faculty member's load after
        assign() has run. Useful for logging or a debug endpoint.
        """
        rows = []
        for f in self.faculty_list:
            name   = f["name"]
            status = f.get("status", "full-time")
            used   = self._assigned_units.get(name, 0.0)
            n_courses = len(self._faculty_courses.get(name, set()))
            cap    = compute_effective_max_units(status, n_courses)
            rows.append({
                "name":           name,
                "status":         status,
                "assigned_units": round(used, 2),
                "course_count":   n_courses,
                "effective_max":  cap,
                "overloaded":     used > cap,
            })
        rows.sort(key=lambda r: (-r["assigned_units"], r["name"]))
        return rows
