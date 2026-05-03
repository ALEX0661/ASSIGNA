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
  • Split-session parity     – both halves of a split lecture → same instructor
  • Merged-block parity      – merged blocks (e.g. 5-A / 5-B) → same instructor,
                               and only ONE slot + ONE unit-block is counted

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
        event:       dict,
    ) -> float:
        name   = faculty["name"]
        status = faculty.get("status", "full-time").lower()
        score  = 0.0

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

        # Preferred day
        preferred_days = faculty.get("preferredDays", [])
        if preferred_days and event.get("day") in preferred_days:
            score += W_PREF_DAY

        # Preferred time window
        start_slot = event.get("_start_slot")
        ev_units   = float(event.get("units", 0))
        if start_slot is not None and ev_units:
            slots_per_day  = 28  # (21 - 7) / 0.5
            local_slot     = start_slot % slots_per_day
            ev_start_hour  = SLOT_START_HOUR + local_slot * SLOT_INCREMENT
            ev_end_hour    = ev_start_hour + ev_units
            pref_start     = float(faculty.get("preferredTimeStart", SLOT_START_HOUR))
            pref_end       = float(faculty.get("preferredTimeEnd",   21.0))
            if ev_start_hour >= pref_start and ev_end_hour <= pref_end:
                score += W_PREF_TIME

        return score

    # ── Grouping ──────────────────────────────────────────────────────────────

    def _group_events(self, schedule: list[dict]) -> list[list[dict]]:
        """
        Group events that must share the same faculty.

        Group key rules
        ───────────────
        merged   – schedule_id looks like "<num>-A" or "<num>-B"
                   → all events with the same numeric base share one instructor
        block    – everything else → keyed by (courseCode, block)
                   → covers single-session events AND split lectures
                   (split lectures share the same block letter)
        """
        groups: dict[str, list[dict]] = defaultdict(list)

        for ev in schedule:
            sid  = str(ev.get("schedule_id", ""))
            code = ev.get("courseCode", "")
            blk  = ev.get("block", "")

            m = re.match(r'^(\d+)-[A-Z]$', sid)
            if m:
                key = f"merged_{m.group(1)}_{code}"
            else:
                key = f"block_{code}_{blk}"

            groups[key].append(ev)

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
                score = self._score(faculty, course_code, events[0])
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

        # Mark each event
        for ev in events:
            ev["faculty"]             = faculty_name
            ev["facultyAutoAssigned"] = True
            ev["assignmentScore"]     = round(self._score(fac_obj, course_code, ev), 2)

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

    def _mark_tba(self, events: list[dict], course_code: str) -> None:
        for ev in events:
            ev["faculty"]             = "TBA"
            ev["facultyAutoAssigned"] = False
            ev["assignmentScore"]     = None

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

        # ── Sort groups: fewest qualified faculty first (hardest to satisfy) ──
        def _rarity(group: list[dict]) -> int:
            code = group[0].get("courseCode", "")
            return sum(
                1 for f in self.faculty_list
                if self._has_specialization(f, code)
            )

        groups.sort(key=_rarity)

        tba_codes: list[str] = []

        for group in groups:
            code = group[0].get("courseCode", "")
            best = self._find_best(code, group)

            if best:
                self._apply_assignment(best, code, group)
                logger.debug(
                    "Assigned %s → %s (block %s)",
                    best, code, group[0].get("block", "?"),
                )
            else:
                self._mark_tba(group, code)
                tba_codes.append(code)
                logger.warning(
                    "TBA: no eligible faculty for %s block %s",
                    code, group[0].get("block", "?"),
                )

        if tba_codes:
            unique_tba = sorted(set(tba_codes))
            logger.warning("Assignment complete. TBA courses: %s", unique_tba)
        else:
            logger.info("Assignment complete. All sessions assigned successfully.")

        return schedule

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
