from ortools.sat.python import cp_model
from collections import defaultdict
from app.core.globals import schedule_dict, progress_state, running_processes, cancel_flags, failure_details, phase_state
from app.core.firebase import get_courses, get_rooms, get_time, get_days, load_all_caches
from app.core.faculty_assigner import FacultyAssigner
import logging
import math
import random 
from typing import List, Dict, Tuple, Set, Optional
from enum import Enum

logger = logging.getLogger("schedgeneration")

# --- PHASES ---
class SchedulingPhase(Enum):
    NSTP = 1        # Phase 1: Strictly Fri/Sat only
    GEC_MAT = 2     # Phase 2: Strict Mon-Thu Pattern + Timeframes
    MAJORS_Y4 = 3   # Phase 3: Practicum
    MAJORS_Y3 = 4   
    MAJORS_Y2 = 5   
    MAJORS_Y1 = 6
    PE = 7          # Phase 7: Last (to fill edges)

# --- Constants ---
PHYSICAL_SESSION_LIMIT = 6 
MAX_PHYSICAL_SESSIONS_PER_DAY = 2 

# The order solve() falls back to today: phases sorted by their enum value.
# Exposed as a named constant so routers can advertise the default without
# recomputing/duplicating the sort logic.
DEFAULT_PHASE_ORDER = [p.name for p in sorted(SchedulingPhase, key=lambda p: p.value)]


def validate_phase_order(order: list) -> list:
    """Validate that `order` is an exact permutation of all phase names.

    Returns the corresponding list of SchedulingPhase members (in the
    given order) on success. Raises ValueError otherwise.
    """
    valid_names = {p.name for p in SchedulingPhase}
    if set(order) != valid_names or len(order) != len(valid_names):
        raise ValueError(
            f"phase_order must contain exactly these phases once each: {sorted(valid_names)}"
        )
    return [SchedulingPhase[name] for name in order]


class HierarchicalScheduler:
    def __init__(self, process_id=None, phase_order=None):
        self.process_id = process_id
        # list[str] of phase names, or None to use the tested default order
        # (sorted by SchedulingPhase enum value). Validated lazily in
        # solve() so a bad value never silently corrupts an in-progress run.
        self.phase_order = phase_order
        self.all_courses = []
        self.rooms = {}
        self.time_settings = {}
        self.days = []
        
        # Time Setup (30-minute granularity)
        self.start_t = 7.0 
        self.end_t = 21.0
        self.inc_hr = 0.5 
        self.slots_per_day = 28 
        self.total_inc = 0
        
        self.occupied_slots = defaultdict(set)
        self.section_occupied = defaultdict(set)
        
        # Track Practicum Load for Balancing (Mon-Wed vs Thu-Sat)
        self.practicum_load_early_week = 0 
        self.practicum_load_late_week = 0  
        
        self.schedule_id_counter = 1
        
    def _get_next_schedule_id(self):
        id_val = self.schedule_id_counter
        self.schedule_id_counter += 1
        return id_val

    def update_progress(self, value):
        if self.process_id:
            progress_state[self.process_id] = value

    def update_phase(self, phase_index, total_phases, phase_name):
        if self.process_id:
            phase_state[self.process_id] = {
                "phase": phase_index,
                "totalPhases": total_phases,
                "phaseName": phase_name,
            }

    def is_cancelled(self):
        """Checked between phases so a Stop click actually halts the solve
        loop instead of merely hiding it from the frontend poller."""
        return self.process_id is not None and self.process_id in cancel_flags

    def load_data(self, semester_filter=None):
        self.update_progress(5)
        # Ensure caches are fresh
        load_all_caches()
        
        courses = get_courses()
        
        self.semester_filter = semester_filter
        if semester_filter:
            courses = [c for c in courses if c.get('semester', '1st Semester') == semester_filter]
            logger.info(f"Filtered to {len(courses)} courses for semester: {semester_filter}")
        
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

    def load_data_for_program(self, program, selected_rooms, semester_filter=None):
        """Load data scoped to a single program with coordinator-selected rooms.
        
        Parameters
        ----------
        program : str
            The program code (e.g., 'BSIT', 'BSCS').
        selected_rooms : dict
            Coordinator-selected rooms, e.g. {"lecture": ["CL1","CL2"], "lab": ["Lab1"]}.
        semester_filter : str, optional
            Filter courses by semester name.
        """
        self.update_progress(5)
        load_all_caches()

        courses = get_courses()

        # Filter to this program only
        courses = [c for c in courses if c.get('program') == program]
        logger.info(f"Coordinator solve: {len(courses)} courses for program {program}")

        self.semester_filter = semester_filter
        if semester_filter:
            courses = [c for c in courses if c.get('semester', '1st Semester') == semester_filter]
            logger.info(f"Filtered to {len(courses)} courses for semester: {semester_filter}")

        self.all_courses = self.prioritize_and_partition_courses(courses)

        self.update_progress(15)
        # Use coordinator-selected rooms instead of global rooms
        self.rooms = selected_rooms if selected_rooms else get_rooms()
        self.normalized_rooms = {}
        for k, v in self.rooms.items():
            self.normalized_rooms[k.lower()] = v if isinstance(v, list) else []
            random.shuffle(self.normalized_rooms[k.lower()])

        self.update_progress(35)
        self.time_settings = get_time()

        self.update_progress(45)
        self.days = get_days()
        self.setup_time_parameters()
        self.update_progress(50)
        
    def prioritize_and_partition_courses(self, courses):
        categorized = defaultdict(list)
        result = []
        
        major_phases = {
            1: SchedulingPhase.MAJORS_Y1, 
            2: SchedulingPhase.MAJORS_Y2,
            3: SchedulingPhase.MAJORS_Y3, 
            4: SchedulingPhase.MAJORS_Y4
        }
        
        for course in courses:
            code = course['courseCode'].upper()
            yr = int(course.get('yearLevel', 1))
            
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
            
            # Priority Score: Labs first, then high block count, then unit load
            p_score = ((0 if lab == 0 else 1000) + int(course.get('blocks', 1)) * 100 + (lec + lab) * 10)
            categorized[phase].append((p_score, course))
            
        for phase in sorted(categorized.keys(), key=lambda p: p.value):
            courses_list = categorized[phase]
            courses_list.sort(key=lambda x: x[0], reverse=True) 
            for _, course in courses_list: 
                result.append((phase, course))
            
        return result
    
    def setup_time_parameters(self):
        s = self.time_settings.get("start_time", 7)
        e = self.time_settings.get("end_time", 21)
        self.start_t = float(s)
        self.end_t = float(e)
        self.inc_hr = 0.5 
        self.slots_per_day = int((self.end_t - self.start_t) / self.inc_hr)
        self.total_inc = self.slots_per_day * len(self.days)
        
        # Lunch Break: 11:30 - 12:30
        start_offset_hrs = 11.5 - self.start_t
        if start_offset_hrs >= 0:
            lunch_start_idx = int(start_offset_hrs / self.inc_hr)
            self.lunch_slots = {lunch_start_idx, lunch_start_idx + 1} 
        else:
            self.lunch_slots = set()

    def _analyze_phase_failure(self, phase, courses):
        """Analyzes why a specific phase failed to generate and returns a diagnostic payload."""
        phase_name = phase.name
        total_sections = sum(int(c.get('blocks', 1)) for c in courses)
        lec_rooms = len(self.rooms.get('lecture', []))
        lab_rooms = len(self.rooms.get('lab', []))
        
        reasons = []
        suggestions = []
        
        if phase_name == "GEC_MAT":
            reasons.append(f"GEC/MAT courses require strict Mon-Thu paired time slots across {total_sections} section block(s).")
            if lec_rooms <= 2:
                suggestions.append(f"You currently have only {lec_rooms} lecture room(s) assigned. Add at least 2-3 more lecture rooms.")
            suggestions.append("Check if GEC/MAT courses have duplicate block entries or tight time settings.")

        elif phase_name == "NSTP":
            reasons.append("NSTP courses are restricted strictly to Friday and Saturday time slots.")
            suggestions.append("Add more lecture rooms or ensure Friday/Saturday hours are not blocked.")

        elif "MAJORS" in phase_name:
            reasons.append(f"{phase_name} has {total_sections} major section(s) competing for limited specialized rooms.")
            if lab_rooms == 0:
                suggestions.append("No lab rooms are selected. Select dedicated lab rooms for major courses.")
            else:
                suggestions.append("Select additional lecture/lab rooms to resolve section scheduling collisions.")

        else:
            reasons.append(f"Could not find valid non-overlapping time slots for {len(courses)} courses in {phase_name}.")
            suggestions.append("Increase operating hours in Settings or add more available rooms.")

        return {
            "status": "failed",
            "failed_phase": phase_name,
            "course_count": len(courses),
            "section_count": total_sections,
            "reasons": reasons,
            "suggestions": suggestions
        }
            
    def solve(self):
        self.update_progress(52)
        phases = defaultdict(list)
        
        for phase, course in self.all_courses:
            phases[phase].append(course)
            
        combined_schedule = []
        if self.phase_order:
            try:
                sorted_phases = validate_phase_order(self.phase_order)
            except ValueError as e:
                logger.warning(f"Invalid phase_order, falling back to default: {e}")
                sorted_phases = sorted(phases.keys(), key=lambda p: p.value)
        else:
            sorted_phases = sorted(phases.keys(), key=lambda p: p.value)
        total_p = len(sorted_phases)
        
        for i, phase in enumerate(sorted_phases, 1):
            if self.is_cancelled():
                logger.info(f"Solve {self.process_id} cancelled before phase check — stopping.")
                return "cancelled"

            p_courses = phases[phase]
            if not p_courses: continue
            
            logger.info(f"Starting Phase {phase.name}: {len(p_courses)} courses")
            self.update_phase(i, total_p, phase.name)
            
            # Dynamic timeouts based on phase complexity
            base_timeout = 30 + (len(p_courses) * 2)
            if phase == SchedulingPhase.GEC_MAT: base_timeout += 60
            if phase == SchedulingPhase.PE: base_timeout += 60 
            if phase == SchedulingPhase.MAJORS_Y3: base_timeout += 90
            
            p_sched = self.solve_phase_logic(p_courses, phase, base_timeout)
            
            if p_sched is None:
                logger.error(f"Failed Phase {phase.name}")
                return self._analyze_phase_failure(phase, p_courses)
                
            combined_schedule.extend(p_sched)
            self.update_progress(50 + int((i / total_p) * 45))
            
        # NOTE: Internal tracking keys (_start_slot, _duration, _room_type,
        # _room_idx) are intentionally kept here so that FacultyAssigner can
        # use them for double-booking detection. They are stripped in
        # generate_schedule() after faculty assignment is complete.
        return combined_schedule

    def solve_phase_logic(self, phase_courses, phase, timeout):
        model = cp_model.CpModel()
        solver = cp_model.CpSolver()
        
        phase_sessions = []
        section_intervals = defaultdict(list)
        room_intervals = defaultdict(list)
        
        # Add "Blockages" for slots already taken by previous phases
        for (r_type, r_idx), slots in self.occupied_slots.items():
            if not slots: continue
            sorted_slots = sorted(list(slots))
            s_start = sorted_slots[0]
            curr = sorted_slots[0]
            
            def add_blockage(start, length):
                blk = model.NewFixedSizeIntervalVar(start, length, f"blk_{r_type}_{r_idx}_{start}")
                room_intervals[(r_type, r_idx)].append(blk)

            for slot in sorted_slots[1:]:
                if slot == curr + 1: 
                    curr = slot
                else:
                    add_blockage(s_start, curr - s_start + 1)
                    s_start = slot
                    curr = slot
            add_blockage(s_start, curr - s_start + 1)

        for course in phase_courses:
            sessions = self.create_course_sessions(model, course, section_intervals, room_intervals)
            if sessions is None: return None
            phase_sessions.extend(sessions)

        # Apply Global Non-Overlap Constraints
        for ints in section_intervals.values(): model.AddNoOverlap(ints)
        for ints in room_intervals.values(): model.AddNoOverlap(ints)
        
        self.add_room_consistency(model, phase_sessions)
        
        solver.parameters.max_time_in_seconds = float(timeout)
        
        # Auto-detect CPU cores. Cap at 4 to prevent cloud providers (like Railway) 
        # from heavily throttling the container for using too much shared CPU/RAM.
        import os
        available_cores = os.cpu_count() or 2
        solver.parameters.num_search_workers = min(available_cores, 4)
        
        status = solver.Solve(model)
        
        if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            sched = self.extract_phase_solution(solver, phase_sessions)
            self.update_occupancy_from_schedule(sched)
            return sched
        else:
            return None

    def get_valid_domain(self, course, sess_type, duration_slots, occupied_slots, 
                        is_gec, is_nstp, is_pe, is_practicum, practicum_window=None):
        
        primary_domain = []   # Preferred slots (No lunch conflict)
        secondary_domain = [] # Fallback slots
        
        gec_strict_offsets = [0, 3, 6, 11, 14, 17, 21, 24]
        nstp_strict_offsets = [4, 12, 16]
        
        yr = int(course.get('yearLevel', 1))
        is_y3_lab = (yr == 3 and sess_type == 'lab')

        for day_idx in range(len(self.days)):
            base = day_idx * self.slots_per_day
            
            if is_nstp and day_idx not in [4, 5]: continue 
            if is_gec and day_idx not in [0, 1, 2, 3]: continue 
            
            if is_practicum and practicum_window is not None:
                if practicum_window == 0 and day_idx > 2: continue
                if practicum_window == 1 and day_idx < 3: continue

            if is_pe:
                day_occupancy = [s - base for s in occupied_slots if base <= s < base + self.slots_per_day]
                if not day_occupancy:
                    allowed_offsets = [0]
                else:
                    min_slot = min(day_occupancy)
                    max_slot = max(day_occupancy)
                    allowed_offsets = []
                    start_before = min_slot - duration_slots
                    if start_before >= 0: allowed_offsets.append(start_before)
                    start_after = max_slot + 1
                    if start_after + duration_slots <= self.slots_per_day: allowed_offsets.append(start_after)
            elif is_gec:
                allowed_offsets = gec_strict_offsets
            elif is_nstp:
                allowed_offsets = nstp_strict_offsets
            else:
                allowed_offsets = range(0, self.slots_per_day - duration_slots + 1)

            for offset in allowed_offsets:
                start_slot = base + offset
                if start_slot + duration_slots > (day_idx + 1) * self.slots_per_day: continue
                
                slot_range = set(range(start_slot, start_slot + duration_slots))
                if slot_range.intersection(occupied_slots): continue
                
                has_lunch_conflict = False
                for s in range(start_slot, start_slot + duration_slots):
                    day_local_slot = s % self.slots_per_day
                    if day_local_slot in self.lunch_slots:
                        has_lunch_conflict = True
                        break
                
                is_preferred_day = True
                if is_y3_lab and day_idx > 3: 
                    is_preferred_day = False
                
                if not has_lunch_conflict and is_preferred_day:
                    primary_domain.append(start_slot)
                else:
                    secondary_domain.append(start_slot)
        
        return primary_domain + secondary_domain

    def _resolve_preferred_room_index(self, course: dict, sess_type: str) -> Optional[int]:
        """
        If course has a non-empty preferredRoom value, find which index it sits
        at inside self.normalized_rooms[sess_type]. Returns the index, or None
        when the room is not found in that type's list (scheduler falls back to
        picking freely).
        """
        preferred = (course.get("preferredRoom") or "").strip()
        if not preferred:
            return None

        rooms_list = self.normalized_rooms.get(sess_type.lower(), [])
        try:
            return rooms_list.index(preferred)
        except ValueError:
            # Room name not in this type's list - log and fall back gracefully
            logger.warning(
                f"Course {course.get('courseCode')} preferredRoom='{preferred}' "
                f"not found in {sess_type} rooms — assigning freely."
            )
            return None

    def create_course_sessions(self, model, course, section_intervals, room_intervals):
        code = course["courseCode"]
        title = course['title'].upper()
        
        is_practicum = "PRACTICUM" in title or "422" in code or "131" in code
        if is_practicum:
            return self.create_practicum_sessions(model, course, section_intervals, room_intervals)

        try:
            lec_u = float(course.get("unitsLecture", 0))
            lab_u = float(course.get("unitsLab", 0))
        except (ValueError, TypeError): 
            lec_u, lab_u = 0, 0
        
        num_blocks = int(course.get("blocks", 1))
        block_letters = [chr(ord('A') + b) for b in range(num_blocks)]
        all_sess = []
        
        is_nstp = "NSTP" in code
        is_gec = code.startswith("GEC") or code.startswith("MAT")
        is_pe = "PE" in code or "PATHFIT" in code
        yr = int(course.get('yearLevel', 1))

        # Handle Lecture Sessions
        if lec_u > 0:
            should_merge = is_nstp or is_gec or is_pe
            processed_indices = set()
            total_slots = int(lec_u * 2)
            
            if is_pe:
                count = 1; dur = total_slots
                if dur > 8: count, dur = 2, total_slots // 2
            else:
                if total_slots > 3 and not is_nstp: 
                    count, dur = 2, total_slots // 2
                else: 
                    count, dur = 1, total_slots
                if count > 2: count, dur = 2, total_slots // 2 
            
            for i in range(num_blocks):
                if i in processed_indices: continue
                blk = block_letters[i]
                
                if should_merge and (i + 1) < num_blocks:
                    blk_next = block_letters[i+1]
                    merged_sess = self.create_shared_session(
                        model, course, blk, blk_next, 'lecture', count, dur,
                        section_intervals, room_intervals, is_gec, is_nstp
                    )
                    if merged_sess:
                        all_sess.extend(merged_sess)
                        processed_indices.add(i); processed_indices.add(i+1)
                        continue
                
                s = self.create_constrained_session(
                    model, course, blk, 'lecture', count, dur,
                    section_intervals, room_intervals, 
                    is_gec, is_nstp, is_pe, force_online=False
                )
                if s is None: return None
                all_sess.extend(s)
                processed_indices.add(i)

        # Handle Lab Sessions
        if lab_u > 0:
            if lab_u == 1: 
                count, dur = 2, 3 
            else: 
                total = int(lab_u * 6)
                count = 2; dur = total // 2
            if count > 2: count, dur = 2, total // 2
            
            for blk in block_letters:
                s = self.create_constrained_session(
                    model, course, blk, 'lab', count, dur,
                    section_intervals, room_intervals,
                    False, False, False, force_online=False
                ) 
                if s is None: return None
                all_sess.extend(s)

        for blk in block_letters:
            blk_sess = [x for x in all_sess if x['blk'] == blk]
            if blk_sess: self.add_daily_limits(model, blk_sess)
            
        return all_sess

    def create_practicum_sessions(self, model, course, section_intervals, room_intervals):
        code = course["courseCode"]
        num_blocks = int(course.get("blocks", 1))
        block_letters = [chr(ord('A') + b) for b in range(num_blocks)]
        
        try:
            l_u = float(course.get("unitsLecture", 0))
            lb_u = float(course.get("unitsLab", 0))
            total_hours = (lb_u * 3) + l_u
            if total_hours == 0: total_hours = 6
        except (ValueError, TypeError):
            total_hours = 6
            
        num_days = 3 if total_hours > 18 else 2
        hours_per_day = total_hours / num_days
        slots_per_day = int(math.ceil(hours_per_day / self.inc_hr))
        all_practicum_sess = []
        
        for blk in block_letters:
            sk = (course["program"], course['yearLevel'], blk)
            occupied = self.section_occupied.get(sk, set())
            
            target_window = 0 if self.practicum_load_early_week <= self.practicum_load_late_week else 1
            
            valid_starts = self.get_valid_domain(
                course, 'practicum', slots_per_day, occupied, 
                False, False, False, True, practicum_window=target_window
            )
            
            if not valid_starts:
                target_window = 1 if target_window == 0 else 0
                valid_starts = self.get_valid_domain(
                    course, 'practicum', slots_per_day, occupied, 
                    False, False, False, True, practicum_window=target_window
                )
            
            if not valid_starts:
                logger.error(f"No slots for Practicum {code} {blk}")
                return None
                
            prev_day_var = None
            if target_window == 0: self.practicum_load_early_week += 1
            else: self.practicum_load_late_week += 1
            
            for i in range(num_days):
                sid = self._get_next_schedule_id()
                s = model.NewIntVarFromDomain(cp_model.Domain.FromValues(valid_starts), f"prac_{sid}_s")
                e = model.NewIntVar(slots_per_day, self.total_inc, f"prac_{sid}_e")
                d = model.NewIntVar(0, len(self.days)-1, f"prac_{sid}_d")
                
                model.Add(e == s + slots_per_day)
                model.Add(s >= d * self.slots_per_day)
                model.Add(s < (d+1) * self.slots_per_day)
                
                iv = model.NewIntervalVar(s, slots_per_day, e, f"iv_p_{sid}")
                section_intervals[sk].append(iv)
                
                if prev_day_var is not None: model.Add(d == prev_day_var + 1)
                
                prev_day_var = d
                
                rv = None
                rtype_to_use = 'practicum'
                if getattr(self, 'semester_filter', None) == 'Midyear':
                    # Find a physical room to use, fallback to lecture if lab is not available
                    rooms_avail = self.normalized_rooms.get('laboratory', [])
                    rtype_to_use = 'laboratory'
                    if not rooms_avail:
                        rooms_avail = self.normalized_rooms.get('lecture', [])
                        rtype_to_use = 'lecture'
                        
                    if rooms_avail:
                        r_indices = list(range(len(rooms_avail)))
                        rv = model.NewIntVarFromDomain(cp_model.Domain.FromValues(r_indices), f"r_{sid}")
                        for rid in r_indices:
                            lit = model.NewBoolVar(f"u_{sid}_{rid}")
                            model.Add(rv == rid).OnlyEnforceIf(lit)
                            model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                            
                            room_intervals[(rtype_to_use, rid)].append(
                                model.NewOptionalIntervalVar(s, slots_per_day, e, lit, f"opt_{sid}_{rid}")
                            )
                
                all_practicum_sess.append({
                    'id': sid, 'code': code, 'title': course['title'], 
                    'prog': course['program'], 'yr': course['yearLevel'], 
                    'blk': blk, 'type': 'practicum', 
                    'room_type': rtype_to_use if rv is not None else None,
                    'start': s, 'end': e, 'day': d, 'room': rv, 
                    'duration': slots_per_day
                })

        return all_practicum_sess

    def create_shared_session(self, model, course, blk1, blk2, sess_type, 
                             num_sessions, duration_slots, 
                             section_intervals, room_intervals, is_gec, is_nstp):
        code = course["courseCode"]
        yr = course['yearLevel']
        prog = course["program"]
        sk1 = (prog, yr, blk1); sk2 = (prog, yr, blk2)
        combined_occ = self.section_occupied.get(sk1, set()).union(self.section_occupied.get(sk2, set()))
        
        valid_domain = self.get_valid_domain(course, sess_type, duration_slots, combined_occ, is_gec, is_nstp, False, False)
        if not valid_domain: return None
        
        created = []; day_vars = []
        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices = list(range(len(rooms_avail)))
        
        for i in range(num_sessions):
            sid = self._get_next_schedule_id()
            is_phys = (i < PHYSICAL_SESSION_LIMIT)
            s = model.NewIntVarFromDomain(cp_model.Domain.FromValues(valid_domain), f"s_sh_{sid}")
            e = model.NewIntVar(duration_slots, self.total_inc, f"e_sh_{sid}")
            d = model.NewIntVar(0, len(self.days)-1, f"d_sh_{sid}")
            
            model.Add(e == s + duration_slots)
            model.Add(s >= d * self.slots_per_day)
            model.Add(s < (d+1) * self.slots_per_day)
            
            iv1 = model.NewIntervalVar(s, duration_slots, e, f"iv_sh1_{sid}")
            iv2 = model.NewIntervalVar(s, duration_slots, e, f"iv_sh2_{sid}")
            section_intervals[sk1].append(iv1); section_intervals[sk2].append(iv2)
            
            rv = None
            if is_phys and rooms_avail:
                # --- preferredRoom Resolution ---
                preferred_idx = self._resolve_preferred_room_index(course, sess_type)
                effective_indices = [preferred_idx] if preferred_idx is not None else r_indices

                rv = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(effective_indices), f"r_sh_{sid}"
                )
                for rid in effective_indices:
                    lit = model.NewBoolVar(f"u_sh_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit)
                    model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                    room_intervals[(sess_type.lower(), rid)].append(
                        model.NewOptionalIntervalVar(s, duration_slots, e, lit, f"opt_sh_{sid}_{rid}")
                    )

            base = {'code': code, 'title': course['title'], 'prog': prog, 'yr': yr, 'type': sess_type, 'start': s, 'end': e, 'day': d, 'room': rv, 'duration': duration_slots}
            created.append({**base, 'id': f"{sid}-A", 'blk': blk1})
            created.append({**base, 'id': f"{sid}-B", 'blk': blk2})
            day_vars.append(d)

        if len(day_vars) > 1: model.AddAllDifferent(day_vars)

        if is_gec and len(day_vars) == 2:
            model.AddAllowedAssignments([day_vars[0], day_vars[1]], [(0, 1), (1, 0), (2, 3), (3, 2)])
            m1 = model.NewIntVar(0, self.slots_per_day, f"m1_sh_{code}")
            m2 = model.NewIntVar(0, self.slots_per_day, f"m2_sh_{code}")
            model.AddModuloEquality(m1, created[0]['start'], self.slots_per_day)
            model.AddModuloEquality(m2, created[2]['start'], self.slots_per_day) # created[2] because created[1] is blk2 session 1
            model.Add(m1 == m2)

        return created

    def create_constrained_session(self, model, course, blk, sess_type, 
                                   num_sessions, duration_slots, 
                                   section_intervals, room_intervals,
                                   is_gec, is_nstp, is_pe, force_online):
        code = course["courseCode"]
        yr = course['yearLevel']
        prog = course["program"]
        sk = (prog, yr, blk)
        occupied = self.section_occupied.get(sk, set())
        
        final_domain = self.get_valid_domain(course, sess_type, duration_slots, occupied, is_gec, is_nstp, is_pe, False)
        if not final_domain:
            logger.error(f"No valid slots for {code} {blk} ({sess_type})")
            return None
        
        created = []; day_vars = []
        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices = list(range(len(rooms_avail)))
        
        for i in range(num_sessions):
            sid = self._get_next_schedule_id()
            is_phys = (i < PHYSICAL_SESSION_LIMIT) and not force_online
            s = model.NewIntVarFromDomain(cp_model.Domain.FromValues(final_domain), f"s_{sid}")
            e = model.NewIntVar(duration_slots, self.total_inc, f"e_{sid}")
            d = model.NewIntVar(0, len(self.days)-1, f"d_{sid}")
            
            model.Add(e == s + duration_slots)
            model.Add(s >= d * self.slots_per_day)
            model.Add(s < (d+1) * self.slots_per_day)
            
            iv = model.NewIntervalVar(s, duration_slots, e, f"iv_{sid}")
            section_intervals[sk].append(iv)
            
            rv = None
            if is_phys and rooms_avail:
                # --- preferredRoom Resolution ---
                preferred_idx = self._resolve_preferred_room_index(course, sess_type)
                effective_indices = [preferred_idx] if preferred_idx is not None else r_indices

                rv = model.NewIntVarFromDomain(
                    cp_model.Domain.FromValues(effective_indices), f"r_{sid}"
                )
                for rid in effective_indices:
                    lit = model.NewBoolVar(f"u_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit)
                    model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                    room_intervals[(sess_type.lower(), rid)].append(
                        model.NewOptionalIntervalVar(s, duration_slots, e, lit, f"opt_{sid}_{rid}")
                    )
            
            created.append({'id': sid, 'code': code, 'title': course['title'], 'prog': prog, 'yr': yr, 'blk': blk, 'type': sess_type, 'start': s, 'end': e, 'day': d, 'room': rv, 'duration': duration_slots})
            day_vars.append(d)

        if len(day_vars) > 1: model.AddAllDifferent(day_vars)
        
        if is_gec and len(day_vars) == 2:
            model.AddAllowedAssignments([day_vars[0], day_vars[1]], [(0, 1), (1, 0), (2, 3), (3, 2)])
            m1 = model.NewIntVar(0, self.slots_per_day, f"m1_{code}_{blk}")
            m2 = model.NewIntVar(0, self.slots_per_day, f"m2_{code}_{blk}")
            model.AddModuloEquality(m1, created[0]['start'], self.slots_per_day)
            model.AddModuloEquality(m2, created[1]['start'], self.slots_per_day)
            model.Add(m1 == m2)

        return created

    def add_daily_limits(self, model, sessions):
        for d in range(len(self.days)):
            p_on_d = []
            for s in sessions:
                b = model.NewBoolVar(f"d{d}_{s['id']}")
                model.Add(s['day'] == d).OnlyEnforceIf(b)
                model.Add(s['day'] != d).OnlyEnforceIf(b.Not())
                if s['room'] is not None: p_on_d.append(b)
            if p_on_d: model.Add(sum(p_on_d) <= MAX_PHYSICAL_SESSIONS_PER_DAY)

    def add_room_consistency(self, model, sessions):
        by_c = defaultdict(list)
        for s in sessions:
            if s['room'] is not None: 
                key = (s['code'], s['blk'], s['type'])
                by_c[key].append(s['room'])
        for rvs in by_c.values():
            if len(rvs) > 1: [model.Add(o == rvs[0]) for o in rvs[1:]]

    def extract_phase_solution(self, solver, sessions):
        sched = []
        for s in sessions:
            r_type = s.get('room_type') or s['type']
            r_name = "online"; r_idx = -1
            if s['room'] is not None:
                r_idx = solver.Value(s['room'])
                avail = self.normalized_rooms.get(r_type.lower(), [])
                if 0 <= r_idx < len(avail): r_name = avail[r_idx]
            
            sv = solver.Value(s['start']); dv = solver.Value(s['day']); dur = s['duration']
            
            st_f = self.start_t + (sv % self.slots_per_day) * self.inc_hr; en_f = st_f + dur * self.inc_hr
            
            def fmt(t):
                h = int(t); m = int((t-h)*60); ampm = "AM" if h < 12 else "PM"
                if h > 12: h -= 12
                if h == 0: h = 12; ampm = "AM"
                if h == 12 and ampm == "AM": ampm = "PM"
                return f"{h}:{m:02d} {ampm}"
            
            sched.append({
                'schedule_id': s['id'], 'courseCode': s['code'], 'baseCourseCode': s['code'], 
                'title': s['title'], 'program': s['prog'], 'year': s['yr'], 
                'session': 'Lecture' if s['type']=='lecture' else ('Practicum' if s['type']=='practicum' else 'Laboratory'), 
                'block': s['blk'], 'day': self.days[dv], 'period': f"{fmt(st_f)} - {fmt(en_f)}", 'room': r_name, 
                
               
                'units': dur * self.inc_hr, 
                
                '_start_slot': sv, '_duration': dur, '_room_type': r_type.lower() if r_idx != -1 else None, '_room_idx': r_idx
            })
        return sched

    def update_occupancy_from_schedule(self, schedule):
        for e in schedule:
            sk = (e['program'], e['year'], e['block'])
            slots = set(range(e['_start_slot'], e['_start_slot']+e['_duration']))
            self.section_occupied[sk].update(slots)
            if e['_room_type'] and e['_room_idx'] != -1:
                self.occupied_slots[(e['_room_type'], e['_room_idx'])].update(slots)

def generate_schedule(process_id=None, semester=None, phase_order=None):
    if process_id:
        running_processes.add(process_id)
    try:
        s = HierarchicalScheduler(process_id, phase_order=phase_order)

        if s.is_cancelled():
            if process_id: progress_state[process_id] = -2
            return "cancelled"

        s.load_data(semester_filter=semester)
        
        # Add diagnostic logging
        logger.info(f"Loaded data: {len(s.all_courses)} courses, {len(s.rooms)} room types, {len(s.days)} days")
        
        # Check for common issues that cause infeasibility
        if not s.all_courses:
            logger.error("No courses found - check course data and semester filter")
            if process_id: progress_state[process_id] = -1
            return "impossible"
            
        if not s.rooms:
            logger.error("No rooms configured - check room settings")
            if process_id: progress_state[process_id] = -1
            return "impossible"
            
        total_room_count = sum(len(rooms) for rooms in s.rooms.values())
        if total_room_count == 0:
            logger.error("No actual rooms available in any category")
            if process_id: progress_state[process_id] = -1
            return "impossible"
            
        logger.info(f"Starting solver with {total_room_count} total rooms available")
        
        res = s.solve()
        if res == "cancelled":
            logger.info(f"Solve {process_id} stopped after cancel request.")
            if process_id: progress_state[process_id] = -2
            return "cancelled"
            
        if isinstance(res, dict) and res.get("status") == "failed":
            # progress_state must stay numeric (the /generate "already
            # running" check and get_status()'s == comparisons depend on
            # it) — the diagnostic payload goes in its own dict instead.
            if process_id:
                failure_details[process_id] = res
                progress_state[process_id] = -1
            return "impossible"
            
        if res == "impossible": 
            logger.error("Schedule generation failed: Impossible Constraints - try reducing course load or adding more rooms/time slots")
            if process_id: progress_state[process_id] = -1
            return "impossible"

        # --- Faculty Assignment ---
        # Run BEFORE stripping internal tracking keys; the assigner needs
        # _start_slot and _duration for double-booking detection.
        s.update_progress(97)
        assigner = FacultyAssigner()
        assigner.load_faculty()
        res = assigner.assign(res)

        # Log a quick load summary at DEBUG level
        for row in assigner.load_summary():
            logger.debug(
                "Faculty load – %s (%s): %.1f / %.0f units | courses: %d%s",
                row["name"], row["status"],
                row["assigned_units"], row["effective_max"],
                row["course_count"],
                "  *** OVERLOADED ***" if row["overloaded"] else "",
            )

        # --- Strip internal tracking keys now that assignment is done ---
        for event in res:
            for k in ('_start_slot', '_duration', '_room_type', '_room_idx'):
                event.pop(k, None)

        # Ensure schedule_dict is cleared and updated properly
        schedule_dict.clear()
        # This part requires schedule_dict to be a DICTIONARY in globals.py
        schedule_dict.update({str(e['schedule_id']): e for e in res}) 
        
        if process_id: 
            progress_state[process_id] = 100
        return res
    except Exception as e:
        logger.exception(e)
        if process_id: 
            progress_state[process_id] = -1
        return "impossible"
    finally:
        if process_id:
            running_processes.discard(process_id)
            cancel_flags.discard(process_id)


# ── Coordinator-scoped generation ──────────────────────────────────────────────

def _parse_time_str(time_str):
    """Parse a time string like '7:00 AM' or '12:30 PM' to float hours.
    Returns float, e.g. 7.0, 12.5, 13.0."""
    time_str = time_str.strip()
    parts = time_str.split()
    if len(parts) != 2:
        return 0.0
    time_part, ampm = parts
    h, m = time_part.split(':')
    h, m = int(h), int(m)
    if ampm.upper() == 'PM' and h != 12:
        h += 12
    if ampm.upper() == 'AM' and h == 12:
        h = 0
    return h + m / 60.0


def events_to_pre_bookings(events, rooms_config, days, time_settings):
    """Convert persisted schedule events into occupied_slots, section_occupied,
    and faculty_bookings for injection into HierarchicalScheduler.

    Parameters
    ----------
    events : list[dict]
        Saved event objects with 'day', 'period', 'room', 'program', 'year',
        'block', 'assigned_faculty' fields.
    rooms_config : dict
        Global rooms dict, e.g. {"lecture": ["CL1","CL2"], "lab": ["Lab1"]}.
    days : list[str]
        Active days list, e.g. ["Monday", "Tuesday", ...].
    time_settings : dict
        {"start_time": 7, "end_time": 21}.

    Returns
    -------
    tuple of (occupied_slots, section_occupied, faculty_bookings)
        occupied_slots: defaultdict(set) — (room_type, room_idx) → set of slot indices
        section_occupied: defaultdict(set) — (program, year, block) → set of slot indices
        faculty_bookings: defaultdict(list) — faculty_name → list of (start, end) tuples
    """
    occupied_slots = defaultdict(set)
    section_occupied = defaultdict(set)
    faculty_bookings = defaultdict(list)

    # Build room → (type, index) lookup from global rooms config
    room_lookup = {}
    for rtype, room_list in rooms_config.items():
        for idx, name in enumerate(room_list):
            room_lookup[name] = (rtype.lower(), idx)

    # Build day → day_index lookup
    day_indices = {d: i for i, d in enumerate(days)}

    start_t = float(time_settings.get("start_time", 7))
    inc_hr = 0.5
    slots_per_day = int((float(time_settings.get("end_time", 21)) - start_t) / inc_hr)

    for ev in events:
        day_name = ev.get('day', '')
        period = ev.get('period', '')
        room_name = ev.get('room', '')

        if not day_name or not period or day_name not in day_indices:
            continue

        # Parse period "7:00 AM - 8:30 AM" → start_hour, end_hour
        period_parts = period.split(' - ')
        if len(period_parts) != 2:
            continue

        start_hour = _parse_time_str(period_parts[0])
        end_hour = _parse_time_str(period_parts[1])

        day_idx = day_indices[day_name]

        # Convert to slot indices (same formula as HierarchicalScheduler)
        time_slot_start = int((start_hour - start_t) / inc_hr)
        time_slot_end = int((end_hour - start_t) / inc_hr)
        duration = time_slot_end - time_slot_start

        if time_slot_start < 0 or duration <= 0:
            continue

        global_start = day_idx * slots_per_day + time_slot_start

        # Room booking
        room_key = room_lookup.get(room_name)
        if room_key:
            for s in range(global_start, global_start + duration):
                occupied_slots[room_key].add(s)

        # Section booking
        sk = (ev.get('program', ''), ev.get('year', ''), ev.get('block', ''))
        for s in range(global_start, global_start + duration):
            section_occupied[sk].add(s)

        # Faculty booking (don't skip GEC, a person can't be in two rooms at once)
        faculty = ev.get('faculty') or ev.get('assigned_faculty')
        if faculty and faculty != 'TBA':
            faculty_bookings[faculty].append((global_start, global_start + duration))

    logger.info(
        "Pre-bookings extracted: %d room keys, %d section keys, %d faculty",
        len(occupied_slots), len(section_occupied), len(faculty_bookings)
    )
    return occupied_slots, section_occupied, faculty_bookings


def generate_coordinator_schedule(
    process_id, program, semester, selected_rooms, pre_booked_events, phase_order=None
):
    """Generate a schedule scoped to one program, respecting previously
    approved schedules as pre-booked constraints.

    Parameters
    ----------
    process_id : str
        UUID for progress tracking.
    program : str
        Program code (e.g., 'BSIT').
    semester : str or None
        Semester filter.
    selected_rooms : dict
        Coordinator-selected rooms {"lecture": [...], "lab": [...]}.
    pre_booked_events : list[dict]
        Events from all previously approved coordinator schedules.
    """
    if process_id:
        running_processes.add(process_id)
    try:
        s = HierarchicalScheduler(process_id, phase_order=phase_order)

        if s.is_cancelled():
            if process_id: progress_state[process_id] = -2
            return "cancelled"

        s.load_data_for_program(program, selected_rooms, semester_filter=semester)

        # --- Inject pre-bookings from approved schedules ---
        if pre_booked_events:
            # BUGFIX: We MUST map room indices using the solver's own shuffled
            # normalized_rooms subset, NOT the global get_rooms(). Otherwise,
            # pre-booked blocks land on the wrong indices and the solver books
            # right over them, causing room conflicts across programs.
            rooms_config = s.normalized_rooms
            days = get_days()
            time_cfg = get_time()

            occ_slots, sec_occ, fac_bookings = events_to_pre_bookings(
                pre_booked_events, rooms_config, days, time_cfg
            )

            # Merge into scheduler's occupancy state
            for key, slots in occ_slots.items():
                s.occupied_slots[key].update(slots)
            for key, slots in sec_occ.items():
                s.section_occupied[key].update(slots)

            logger.info(
                "Injected %d pre-booked room keys and %d section keys",
                len(occ_slots), len(sec_occ)
            )

        res = s.solve()
        if res == "cancelled":
            logger.info(f"Coordinator solve {process_id} stopped after cancel request.")
            if process_id:
                progress_state[process_id] = -2
            return "cancelled"
            
        if isinstance(res, dict) and res.get("status") == "failed":
            # Same rule as generate_schedule(): progress_state stays
            # numeric; the diagnostic dict is tracked separately.
            if process_id:
                failure_details[process_id] = res
                progress_state[process_id] = -1
            return "impossible"
            
        if res == "impossible":
            logger.error("Coordinator schedule generation failed: Impossible Constraints")
            if process_id:
                progress_state[process_id] = -1
            return "impossible"

        # --- Faculty Assignment ---
        s.update_progress(97)
        assigner = FacultyAssigner()
        assigner.load_faculty()

        # Pre-populate faculty slots from approved schedules to prevent
        # cross-program double-booking
        if pre_booked_events and 'fac_bookings' in locals():
            assigner.inject_pre_booked_faculty(fac_bookings)

        res = assigner.assign(res)

        # Log summary
        for row in assigner.load_summary():
            logger.debug(
                "Faculty load – %s (%s): %.1f / %.0f units | courses: %d%s",
                row["name"], row["status"],
                row["assigned_units"], row["effective_max"],
                row["course_count"],
                "  *** OVERLOADED ***" if row["overloaded"] else "",
            )

        # Strip internal tracking keys
        for event in res:
            for k in ('_start_slot', '_duration', '_room_type', '_room_idx'):
                event.pop(k, None)

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
    finally:
        if process_id:
            running_processes.discard(process_id)
            cancel_flags.discard(process_id)