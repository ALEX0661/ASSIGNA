from ortools.sat.python import cp_model
from collections import defaultdict
from app.core.globals import schedule_dict, progress_state
from app.core.firebase import get_courses, get_rooms, get_time, get_days, load_all_caches
import logging
import math
import random
from typing import List, Dict, Tuple, Set, Optional
from enum import Enum

logger = logging.getLogger("schedgeneration")

# ---------------------------------------------------------------------------
# Scheduling Phases
# Courses are solved in phase order (lower value = higher priority).
# ---------------------------------------------------------------------------
class SchedulingPhase(Enum):
    NSTP      = 1   # Phase 1 : Strictly Fri/Sat only
    GEC_MAT   = 2   # Phase 2 : Strict Mon–Thu pattern + timeframes
    MAJORS_Y4 = 3   # Phase 3 : Practicum
    MAJORS_Y3 = 4
    MAJORS_Y2 = 5
    MAJORS_Y1 = 6
    PE        = 7   # Phase 7 : Last — fills edge slots

# ---------------------------------------------------------------------------
# Global constants
# ---------------------------------------------------------------------------
PHYSICAL_SESSION_LIMIT        = 6   # Max sessions per course that get a physical room
MAX_PHYSICAL_SESSIONS_PER_DAY = 2   # Max physical sessions any block can have in one day


# ===========================================================================
# HierarchicalScheduler
# ===========================================================================
class HierarchicalScheduler:

    def __init__(self, process_id=None):
        self.process_id = process_id
        self.all_courses    = []
        self.rooms          = {}
        self.time_settings  = {}
        self.days           = []

        # Time setup (30-minute granularity)
        self.start_t       = 7.0
        self.end_t         = 21.0
        self.inc_hr        = 0.5
        self.slots_per_day = 28
        self.total_inc     = 0

        # Cross-phase occupancy tracking
        self.occupied_slots    = defaultdict(set)   # keyed by (room_type, room_idx)
        self.section_occupied  = defaultdict(set)   # keyed by (program, year, block)

        # Practicum load balancing between Mon–Wed and Thu–Sat windows
        self.practicum_load_early_week = 0
        self.practicum_load_late_week  = 0

        self.schedule_id_counter = 1

    # -----------------------------------------------------------------------
    # Utilities
    # -----------------------------------------------------------------------

    def _get_next_schedule_id(self):
        id_val = self.schedule_id_counter
        self.schedule_id_counter += 1
        return id_val

    def update_progress(self, value):
        if self.process_id:
            progress_state[self.process_id] = value

    # -----------------------------------------------------------------------
    # preferredRoom helper
    # -----------------------------------------------------------------------

    def _resolve_preferred_room_index(self, course: dict, sess_type: str) -> int | None:
        """
        If the course has a non-empty ``preferredRoom`` value, locate that
        room inside ``self.normalized_rooms[sess_type]`` and return its index.

        Returns
        -------
        int
            The index of the preferred room in the type's list, so the CP
            solver's domain can be narrowed to exactly that room.
        None
            When the course has no preference, or the named room is not
            present in the current session-type list.  The caller falls back
            to the full ``r_indices`` domain (free assignment).
        """
        preferred = (course.get("preferredRoom") or "").strip()
        if not preferred:
            return None

        rooms_list = self.normalized_rooms.get(sess_type.lower(), [])
        try:
            return rooms_list.index(preferred)
        except ValueError:
            # The room name is not in this type's list.
            # This can happen when the room belongs to the other type
            # (e.g., a lecture room pinned on a lab session) or when the
            # room was removed from settings after the pin was saved.
            # Log a warning and fall back to free assignment gracefully.
            logger.warning(
                f"Course {course.get('courseCode')} preferredRoom='{preferred}' "
                f"not found in '{sess_type}' rooms — assigning freely."
            )
            return None

    # -----------------------------------------------------------------------
    # Data loading
    # -----------------------------------------------------------------------

    def load_data(self):
        self.update_progress(5)
        load_all_caches()

        courses = get_courses()
        self.all_courses = self.prioritize_and_partition_courses(courses)

        self.update_progress(15)
        self.rooms = get_rooms()
        self.normalized_rooms = {}
        for k, v in self.rooms.items():
            self.normalized_rooms[k.lower()] = v
            random.shuffle(self.normalized_rooms[k.lower()])

        self.update_progress(35)
        self.time_settings = get_time()

        self.update_progress(45)
        self.days = get_days()
        self.setup_time_parameters()
        self.update_progress(50)

    # -----------------------------------------------------------------------
    # Course prioritisation
    # -----------------------------------------------------------------------

    def prioritize_and_partition_courses(self, courses):
        categorized = defaultdict(list)
        result      = []

        major_phases = {
            1: SchedulingPhase.MAJORS_Y1,
            2: SchedulingPhase.MAJORS_Y2,
            3: SchedulingPhase.MAJORS_Y3,
            4: SchedulingPhase.MAJORS_Y4,
        }

        for course in courses:
            code = course['courseCode'].upper()
            yr   = int(course.get('yearLevel', 1))

            try:
                lec = float(course.get('unitsLecture', 0))
                lab = float(course.get('unitsLab', 0))
            except (ValueError, TypeError):
                lec, lab = 0, 0

            if "NSTP" in code:
                phase = SchedulingPhase.NSTP
            elif code.startswith("GEC") or code.startswith("MAT"):
                phase = SchedulingPhase.GEC_MAT
            elif "PE" in code or "PATHFIT" in code:
                phase = SchedulingPhase.PE
            else:
                phase = major_phases.get(yr, SchedulingPhase.MAJORS_Y1)

            # Labs first, then high block count, then total unit load
            p_score = (
                (0 if lab == 0 else 1000)
                + int(course.get('blocks', 1)) * 100
                + (lec + lab) * 10
            )
            categorized[phase].append((p_score, course))

        for phase in sorted(categorized.keys(), key=lambda p: p.value):
            courses_list = categorized[phase]
            courses_list.sort(key=lambda x: x[0], reverse=True)
            for _, course in courses_list:
                result.append((phase, course))

        return result

    # -----------------------------------------------------------------------
    # Time parameters
    # -----------------------------------------------------------------------

    def setup_time_parameters(self):
        s = self.time_settings.get("start_time", 7)
        e = self.time_settings.get("end_time",   21)
        self.start_t       = float(s)
        self.end_t         = float(e)
        self.inc_hr        = 0.5
        self.slots_per_day = int((self.end_t - self.start_t) / self.inc_hr)
        self.total_inc     = self.slots_per_day * len(self.days)

        # Lunch break: 11:30–12:30
        start_offset_hrs = 11.5 - self.start_t
        if start_offset_hrs >= 0:
            lunch_start_idx   = int(start_offset_hrs / self.inc_hr)
            self.lunch_slots  = {lunch_start_idx, lunch_start_idx + 1}
        else:
            self.lunch_slots  = set()

    # -----------------------------------------------------------------------
    # Top-level solve
    # -----------------------------------------------------------------------

    def solve(self):
        self.update_progress(52)
        phases = defaultdict(list)

        for phase, course in self.all_courses:
            phases[phase].append(course)

        combined_schedule = []
        sorted_phases     = sorted(phases.keys(), key=lambda p: p.value)
        total_p           = len(sorted_phases)

        for i, phase in enumerate(sorted_phases, 1):
            p_courses = phases[phase]
            if not p_courses:
                continue

            logger.info(f"Starting Phase {phase.name}: {len(p_courses)} courses")

            # Dynamic timeout scaled to phase complexity
            base_timeout = 30 + (len(p_courses) * 2)
            if phase == SchedulingPhase.GEC_MAT:   base_timeout += 60
            if phase == SchedulingPhase.PE:         base_timeout += 60
            if phase == SchedulingPhase.MAJORS_Y3:  base_timeout += 90

            p_sched = self.solve_phase_logic(p_courses, phase, base_timeout)

            if p_sched is None:
                logger.error(f"Failed Phase {phase.name}")
                return "impossible"

            combined_schedule.extend(p_sched)
            self.update_progress(50 + int((i / total_p) * 45))

        # Strip internal tracking keys before returning to the caller
        for event in combined_schedule:
            for k in ['_start_slot', '_duration', '_room_type', '_room_idx']:
                if k in event:
                    del event[k]

        return combined_schedule

    # -----------------------------------------------------------------------
    # Phase-level CP solve
    # -----------------------------------------------------------------------

    def solve_phase_logic(self, phase_courses, phase, timeout):
        model   = cp_model.CpModel()
        solver  = cp_model.CpSolver()

        phase_sessions   = []
        section_intervals = defaultdict(list)
        room_intervals    = defaultdict(list)

        # Block out slots already occupied by previously solved phases
        for (r_type, r_idx), slots in self.occupied_slots.items():
            if not slots:
                continue
            sorted_slots = sorted(list(slots))
            s_start = sorted_slots[0]
            curr    = sorted_slots[0]

            def add_blockage(start, length):
                blk = model.NewFixedSizeIntervalVar(
                    start, length, f"blk_{r_type}_{r_idx}_{start}"
                )
                room_intervals[(r_type, r_idx)].append(blk)

            for slot in sorted_slots[1:]:
                if slot == curr + 1:
                    curr = slot
                else:
                    add_blockage(s_start, curr - s_start + 1)
                    s_start = slot
                    curr    = slot
            add_blockage(s_start, curr - s_start + 1)

        for course in phase_courses:
            sessions = self.create_course_sessions(
                model, course, section_intervals, room_intervals
            )
            if sessions is None:
                return None
            phase_sessions.extend(sessions)

        # Global non-overlap constraints
        for ints in section_intervals.values():
            model.AddNoOverlap(ints)
        for ints in room_intervals.values():
            model.AddNoOverlap(ints)

        self.add_room_consistency(model, phase_sessions)

        solver.parameters.max_time_in_seconds = float(timeout)
        solver.parameters.num_search_workers  = 8

        status = solver.Solve(model)

        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            sched = self.extract_phase_solution(solver, phase_sessions)
            self.update_occupancy_from_schedule(sched)
            return sched

        return None

    # -----------------------------------------------------------------------
    # Valid-domain builder
    # -----------------------------------------------------------------------

    def get_valid_domain(self, course, sess_type, duration_slots, occupied_slots,
                         is_gec, is_nstp, is_pe, is_practicum,
                         practicum_window=None):

        primary_domain   = []   # Preferred slots (no lunch conflict)
        secondary_domain = []   # Fallback slots

        gec_strict_offsets  = [0, 3, 6, 11, 14, 17, 21, 24]
        nstp_strict_offsets = [4, 12, 16]

        yr       = int(course.get('yearLevel', 1))
        is_y3_lab = (yr == 3 and sess_type == 'lab')

        for day_idx in range(len(self.days)):
            base = day_idx * self.slots_per_day

            if is_nstp and day_idx not in [4, 5]:
                continue
            if is_gec and day_idx not in [0, 1, 2, 3]:
                continue

            if is_practicum and practicum_window is not None:
                if practicum_window == 0 and day_idx > 2:
                    continue
                if practicum_window == 1 and day_idx < 3:
                    continue

            if is_pe:
                day_occupancy = [
                    s - base for s in occupied_slots
                    if base <= s < base + self.slots_per_day
                ]
                if not day_occupancy:
                    allowed_offsets = [0]
                else:
                    min_slot = min(day_occupancy)
                    max_slot = max(day_occupancy)
                    allowed_offsets = []
                    start_before = min_slot - duration_slots
                    if start_before >= 0:
                        allowed_offsets.append(start_before)
                    start_after = max_slot + 1
                    if start_after + duration_slots <= self.slots_per_day:
                        allowed_offsets.append(start_after)
            elif is_gec:
                allowed_offsets = gec_strict_offsets
            elif is_nstp:
                allowed_offsets = nstp_strict_offsets
            else:
                allowed_offsets = range(0, self.slots_per_day - duration_slots + 1)

            for offset in allowed_offsets:
                start_slot = base + offset
                if start_slot + duration_slots > (day_idx + 1) * self.slots_per_day:
                    continue

                slot_range = set(range(start_slot, start_slot + duration_slots))
                if slot_range.intersection(occupied_slots):
                    continue

                has_lunch_conflict = any(
                    s % self.slots_per_day in self.lunch_slots
                    for s in range(start_slot, start_slot + duration_slots)
                )

                is_preferred_day = not (is_y3_lab and day_idx > 3)

                if not has_lunch_conflict and is_preferred_day:
                    primary_domain.append(start_slot)
                else:
                    secondary_domain.append(start_slot)

        return primary_domain + secondary_domain

    # -----------------------------------------------------------------------
    # Course-session dispatcher
    # -----------------------------------------------------------------------

    def create_course_sessions(self, model, course, section_intervals, room_intervals):
        code  = course["courseCode"]
        title = course['title'].upper()

        is_practicum = "PRACTICUM" in title or "422" in code or "131" in code
        if is_practicum:
            return self.create_practicum_sessions(model, course, section_intervals)

        try:
            lec_u = float(course.get("unitsLecture", 0))
            lab_u = float(course.get("unitsLab", 0))
        except (ValueError, TypeError):
            lec_u, lab_u = 0, 0

        num_blocks    = int(course.get("blocks", 1))
        block_letters = [chr(ord('A') + b) for b in range(num_blocks)]
        all_sess      = []

        is_nstp = "NSTP" in code
        is_gec  = code.startswith("GEC") or code.startswith("MAT")
        is_pe   = "PE" in code or "PATHFIT" in code
        yr      = int(course.get('yearLevel', 1))

        # -- Lecture sessions ------------------------------------------------
        if lec_u > 0:
            should_merge      = (yr == 1 or yr == 2) or is_nstp
            processed_indices = set()
            total_slots       = int(lec_u * 2)

            if is_pe:
                count, dur = 1, total_slots
                if dur > 8:
                    count, dur = 2, total_slots // 2
            else:
                if total_slots > 3 and not is_nstp:
                    count, dur = 2, total_slots // 2
                else:
                    count, dur = 1, total_slots
                if count > 2:
                    count, dur = 2, total_slots // 2

            for i in range(num_blocks):
                if i in processed_indices:
                    continue
                blk = block_letters[i]

                if should_merge and (i + 1) < num_blocks:
                    blk_next    = block_letters[i + 1]
                    merged_sess = self.create_shared_session(
                        model, course, blk, blk_next, 'lecture', count, dur,
                        section_intervals, room_intervals, is_gec, is_nstp
                    )
                    if merged_sess:
                        all_sess.extend(merged_sess)
                        processed_indices.add(i)
                        processed_indices.add(i + 1)
                        continue

                s = self.create_constrained_session(
                    model, course, blk, 'lecture', count, dur,
                    section_intervals, room_intervals,
                    is_gec, is_nstp, is_pe, force_online=False
                )
                if s is None:
                    return None
                all_sess.extend(s)
                processed_indices.add(i)

        # -- Lab sessions ----------------------------------------------------
        if lab_u > 0:
            if lab_u == 1:
                count, dur = 2, 3
            else:
                total = int(lab_u * 6)
                count, dur = 2, total // 2
            if count > 2:
                count, dur = 2, total // 2

            for blk in block_letters:
                s = self.create_constrained_session(
                    model, course, blk, 'lab', count, dur,
                    section_intervals, room_intervals,
                    False, False, False, force_online=False
                )
                if s is None:
                    return None
                all_sess.extend(s)

        # Apply per-day physical-session cap per block
        for blk in block_letters:
            blk_sess = [x for x in all_sess if x['blk'] == blk]
            if blk_sess:
                self.add_daily_limits(model, blk_sess)

        return all_sess

    # -----------------------------------------------------------------------
    # Practicum sessions (no room — always online / off-campus)
    # -----------------------------------------------------------------------

    def create_practicum_sessions(self, model, course, section_intervals):
        code        = course["courseCode"]
        num_blocks  = int(course.get("blocks", 1))
        block_letters = [chr(ord('A') + b) for b in range(num_blocks)]

        try:
            l_u        = float(course.get("unitsLecture", 0))
            lb_u       = float(course.get("unitsLab", 0))
            total_hours = (lb_u * 3) + l_u
            if total_hours == 0:
                total_hours = 6
        except (ValueError, TypeError):
            total_hours = 6

        num_days      = 3 if total_hours > 18 else 2
        hours_per_day = total_hours / num_days
        slots_per_day = int(math.ceil(hours_per_day / self.inc_hr))
        all_practicum_sess = []

        for blk in block_letters:
            sk       = (course["program"], course['yearLevel'], blk)
            occupied = self.section_occupied.get(sk, set())

            # Balance load between early-week (Mon–Wed) and late-week (Thu–Sat)
            target_window = (
                0 if self.practicum_load_early_week <= self.practicum_load_late_week
                else 1
            )

            valid_starts = self.get_valid_domain(
                course, 'practicum', slots_per_day, occupied,
                False, False, False, True, practicum_window=target_window
            )

            if not valid_starts:
                # Retry with the other window before giving up
                target_window = 1 if target_window == 0 else 0
                valid_starts  = self.get_valid_domain(
                    course, 'practicum', slots_per_day, occupied,
                    False, False, False, True, practicum_window=target_window
                )

            if not valid_starts:
                logger.error(f"No slots for Practicum {code} {blk}")
                return None

            if target_window == 0:
                self.practicum_load_early_week += 1
            else:
                self.practicum_load_late_week += 1

            prev_day_var = None
            for i in range(num_days):
                sid = self._get_next_schedule_id()
                s   = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(valid_starts), f"prac_{sid}_s"
                )
                e = model.NewIntVar(slots_per_day, self.total_inc, f"prac_{sid}_e")
                d = model.NewIntVar(0, len(self.days) - 1,         f"prac_{sid}_d")

                model.Add(e == s + slots_per_day)
                model.Add(s >= d * self.slots_per_day)
                model.Add(s <  (d + 1) * self.slots_per_day)

                iv = model.NewIntervalVar(s, slots_per_day, e, f"iv_p_{sid}")
                section_intervals[sk].append(iv)

                # Force consecutive days
                if prev_day_var is not None:
                    model.Add(d == prev_day_var + 1)

                prev_day_var = d
                all_practicum_sess.append({
                    'id': sid, 'code': code, 'title': course['title'],
                    'prog': course['program'], 'yr': course['yearLevel'],
                    'blk': blk, 'type': 'practicum',
                    'start': s, 'end': e, 'day': d, 'room': None,
                    'duration': slots_per_day,
                })

        return all_practicum_sess

    # -----------------------------------------------------------------------
    # Shared session (two blocks merged into one physical slot)
    # -----------------------------------------------------------------------

    def create_shared_session(self, model, course, blk1, blk2, sess_type,
                               num_sessions, duration_slots,
                               section_intervals, room_intervals,
                               is_gec, is_nstp):
        code = course["courseCode"]
        yr   = course['yearLevel']
        prog = course["program"]
        sk1  = (prog, yr, blk1)
        sk2  = (prog, yr, blk2)

        combined_occ = (
            self.section_occupied.get(sk1, set())
            .union(self.section_occupied.get(sk2, set()))
        )

        valid_domain = self.get_valid_domain(
            course, sess_type, duration_slots, combined_occ,
            is_gec, is_nstp, False, False
        )
        if not valid_domain:
            return None

        created  = []
        day_vars = []

        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices   = list(range(len(rooms_avail)))

        for i in range(num_sessions):
            sid     = self._get_next_schedule_id()
            is_phys = (i < PHYSICAL_SESSION_LIMIT)

            s = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(valid_domain), f"s_sh_{sid}"
            )
            e = model.NewIntVar(duration_slots, self.total_inc, f"e_sh_{sid}")
            d = model.NewIntVar(0, len(self.days) - 1,          f"d_sh_{sid}")

            model.Add(e == s + duration_slots)
            model.Add(s >= d * self.slots_per_day)
            model.Add(s <  (d + 1) * self.slots_per_day)

            # Both blocks share the same interval — register under both keys
            iv1 = model.NewIntervalVar(s, duration_slots, e, f"iv_sh1_{sid}")
            iv2 = model.NewIntervalVar(s, duration_slots, e, f"iv_sh2_{sid}")
            section_intervals[sk1].append(iv1)
            section_intervals[sk2].append(iv2)

            rv = None
            if is_phys and rooms_avail:
                # ── preferredRoom: narrow the room domain to one specific room ──
                # If the course has a pinned room and it is found in this
                # session type's list, restrict the solver to that room only.
                # If the room is absent from the list (wrong type or removed),
                # _resolve_preferred_room_index returns None and we fall back
                # to the full r_indices domain (free assignment).
                preferred_idx    = self._resolve_preferred_room_index(course, sess_type)
                effective_indices = [preferred_idx] if preferred_idx is not None else r_indices

                rv = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(effective_indices), f"r_sh_{sid}"
                )
                for rid in effective_indices:
                    lit = model.NewBoolVar(f"u_sh_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit)
                    model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                    room_intervals[(sess_type.lower(), rid)].append(
                        model.NewOptionalIntervalVar(
                            s, duration_slots, e, lit, f"opt_sh_{sid}_{rid}"
                        )
                    )

            base = {
                'code': code, 'title': course['title'],
                'prog': prog, 'yr': yr, 'type': sess_type,
                'start': s, 'end': e, 'day': d,
                'room': rv, 'duration': duration_slots,
            }
            created.append({**base, 'id': f"{sid}-A", 'blk': blk1})
            created.append({**base, 'id': f"{sid}-B", 'blk': blk2})
            day_vars.append(d)

        if len(day_vars) > 1:
            model.AddAllDifferent(day_vars)

        # GEC constraint: paired sessions must fall on matching day pairs
        # (Mon↔Tue or Wed↔Thu) and start at the same time-of-day offset
        if is_gec and len(day_vars) == 2:
            model.AddAllowedAssignments(
                [day_vars[0], day_vars[1]],
                [(0, 1), (1, 0), (2, 3), (3, 2)]
            )
            m1 = model.NewIntVar(0, self.slots_per_day, f"m1_sh_{code}")
            m2 = model.NewIntVar(0, self.slots_per_day, f"m2_sh_{code}")
            model.AddModuloEquality(m1, created[0]['start'], self.slots_per_day)
            # created[2] is blk2's second session (created[1] is blk2 of session 0)
            model.AddModuloEquality(m2, created[2]['start'], self.slots_per_day)
            model.Add(m1 == m2)

        return created

    # -----------------------------------------------------------------------
    # Constrained session (single block)
    # -----------------------------------------------------------------------

    def create_constrained_session(self, model, course, blk, sess_type,
                                    num_sessions, duration_slots,
                                    section_intervals, room_intervals,
                                    is_gec, is_nstp, is_pe, force_online):
        code = course["courseCode"]
        yr   = course['yearLevel']
        prog = course["program"]
        sk   = (prog, yr, blk)

        occupied   = self.section_occupied.get(sk, set())
        final_domain = self.get_valid_domain(
            course, sess_type, duration_slots, occupied,
            is_gec, is_nstp, is_pe, False
        )
        if not final_domain:
            logger.error(f"No valid slots for {code} {blk} ({sess_type})")
            return None

        created  = []
        day_vars = []

        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices   = list(range(len(rooms_avail)))

        for i in range(num_sessions):
            sid     = self._get_next_schedule_id()
            is_phys = (i < PHYSICAL_SESSION_LIMIT) and not force_online

            s = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(final_domain), f"s_{sid}"
            )
            e = model.NewIntVar(duration_slots, self.total_inc, f"e_{sid}")
            d = model.NewIntVar(0, len(self.days) - 1,          f"d_{sid}")

            model.Add(e == s + duration_slots)
            model.Add(s >= d * self.slots_per_day)
            model.Add(s <  (d + 1) * self.slots_per_day)

            iv = model.NewIntervalVar(s, duration_slots, e, f"iv_{sid}")
            section_intervals[sk].append(iv)

            rv = None
            if is_phys and rooms_avail:
                # ── preferredRoom: narrow the room domain to one specific room ──
                # If the course has a pinned room and it is found in this
                # session type's list, restrict the solver to that room only.
                # If the room is absent from the list (wrong type or removed),
                # _resolve_preferred_room_index returns None and we fall back
                # to the full r_indices domain (free assignment).
                preferred_idx     = self._resolve_preferred_room_index(course, sess_type)
                effective_indices = [preferred_idx] if preferred_idx is not None else r_indices

                rv = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(effective_indices), f"r_{sid}"
                )
                for rid in effective_indices:
                    lit = model.NewBoolVar(f"u_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit)
                    model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                    room_intervals[(sess_type.lower(), rid)].append(
                        model.NewOptionalIntervalVar(
                            s, duration_slots, e, lit, f"opt_{sid}_{rid}"
                        )
                    )

            created.append({
                'id': sid, 'code': code, 'title': course['title'],
                'prog': prog, 'yr': yr, 'blk': blk,
                'type': sess_type, 'start': s, 'end': e,
                'day': d, 'room': rv, 'duration': duration_slots,
            })
            day_vars.append(d)

        if len(day_vars) > 1:
            model.AddAllDifferent(day_vars)

        # GEC constraint: paired sessions on matching day pairs, same start time
        if is_gec and len(day_vars) == 2:
            model.AddAllowedAssignments(
                [day_vars[0], day_vars[1]],
                [(0, 1), (1, 0), (2, 3), (3, 2)]
            )
            m1 = model.NewIntVar(0, self.slots_per_day, f"m1_{code}_{blk}")
            m2 = model.NewIntVar(0, self.slots_per_day, f"m2_{code}_{blk}")
            model.AddModuloEquality(m1, created[0]['start'], self.slots_per_day)
            model.AddModuloEquality(m2, created[1]['start'], self.slots_per_day)
            model.Add(m1 == m2)

        return created

    # -----------------------------------------------------------------------
    # Constraint helpers
    # -----------------------------------------------------------------------

    def add_daily_limits(self, model, sessions):
        """
        Enforce MAX_PHYSICAL_SESSIONS_PER_DAY: no block may have more than
        the allowed number of physical (room-assigned) sessions on any one day.
        """
        for d in range(len(self.days)):
            p_on_d = []
            for s in sessions:
                b = model.NewBoolVar(f"d{d}_{s['id']}")
                model.Add(s['day'] == d).OnlyEnforceIf(b)
                model.Add(s['day'] != d).OnlyEnforceIf(b.Not())
                if s['room'] is not None:
                    p_on_d.append(b)
            if p_on_d:
                model.Add(sum(p_on_d) <= MAX_PHYSICAL_SESSIONS_PER_DAY)

    def add_room_consistency(self, model, sessions):
        """
        All sessions for the same (course, block, type) tuple must be
        assigned to the same room variable value.
        """
        by_c = defaultdict(list)
        for s in sessions:
            if s['room'] is not None:
                key = (s['code'], s['blk'], s['type'])
                by_c[key].append(s['room'])
        for rvs in by_c.values():
            if len(rvs) > 1:
                for o in rvs[1:]:
                    model.Add(o == rvs[0])

    # -----------------------------------------------------------------------
    # Solution extraction
    # -----------------------------------------------------------------------

    def extract_phase_solution(self, solver, sessions):
        sched = []
        for s in sessions:
            r_name = "online"
            r_type = s['type']
            r_idx  = -1

            if s['room'] is not None:
                r_idx = solver.Value(s['room'])
                avail = self.normalized_rooms.get(r_type.lower(), [])
                if 0 <= r_idx < len(avail):
                    r_name = avail[r_idx]

            sv  = solver.Value(s['start'])
            dv  = solver.Value(s['day'])
            dur = s['duration']

            st_f = self.start_t + (sv % self.slots_per_day) * self.inc_hr
            en_f = st_f + dur * self.inc_hr

            def fmt(t):
                h    = int(t)
                m    = int((t - h) * 60)
                ampm = "AM" if h < 12 else "PM"
                if h > 12:  h -= 12
                if h == 0:  h = 12; ampm = "AM"
                if h == 12 and ampm == "AM": ampm = "PM"
                return f"{h}:{m:02d} {ampm}"

            sched.append({
                'schedule_id':    s['id'],
                'courseCode':     s['code'],
                'baseCourseCode': s['code'],
                'title':          s['title'],
                'program':        s['prog'],
                'year':           s['yr'],
                'session': (
                    'Lecture'   if s['type'] == 'lecture'   else
                    'Practicum' if s['type'] == 'practicum' else
                    'Laboratory'
                ),
                'block':      s['blk'],
                'day':        self.days[dv],
                'period':     f"{fmt(st_f)} - {fmt(en_f)}",
                'room':       r_name,
                # Internal keys consumed by update_occupancy_from_schedule()
                '_start_slot': sv,
                '_duration':   dur,
                '_room_type':  r_type.lower() if r_idx != -1 else None,
                '_room_idx':   r_idx,
            })
        return sched

    # -----------------------------------------------------------------------
    # Cross-phase occupancy update
    # -----------------------------------------------------------------------

    def update_occupancy_from_schedule(self, schedule):
        for e in schedule:
            sk    = (e['program'], e['year'], e['block'])
            slots = set(range(e['_start_slot'], e['_start_slot'] + e['_duration']))
            self.section_occupied[sk].update(slots)
            if e['_room_type'] and e['_room_idx'] != -1:
                self.occupied_slots[(e['_room_type'], e['_room_idx'])].update(slots)


# ===========================================================================
# Entry point
# ===========================================================================

def generate_schedule(process_id=None, semester=None):
    try:
        s = HierarchicalScheduler(process_id)
        s.load_data()
        res = s.solve()

        if res == "impossible":
            logger.error("Schedule generation failed: Impossible Constraints")
            return "impossible"

        schedule_dict.clear()
        schedule_dict.update({str(e['schedule_id']): e for e in res})

        if process_id:
            progress_state[process_id] = 100
        return res

    except Exception as e:
        logger.exception(e)
        if process_id:
            progress_state[process_id] = -1
        return "impossible"