from ortools.sat.python import cp_model
from collections import defaultdict
from app.core.globals import schedule_dict, progress_state
# Fixed: Imports now match the actual function names in firebase.py
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

class HierarchicalScheduler:
    def __init__(self, process_id=None):
        self.process_id = process_id
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

    def load_data(self, semester_filter=None):
        self.update_progress(5)
        # Ensure caches are fresh
        load_all_caches()
        
        # Fixed: Using the correct getter names from firebase.py
        courses = get_courses()
        
        # Filter by semester if specified
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
            
    def solve(self):
        self.update_progress(52)
        phases = defaultdict(list)
        
        for phase, course in self.all_courses:
            phases[phase].append(course)
            
        combined_schedule = []
        sorted_phases = sorted(phases.keys(), key=lambda p: p.value)
        total_p = len(sorted_phases)
        
        for i, phase in enumerate(sorted_phases, 1):
            p_courses = phases[phase]
            if not p_courses: continue
            
            logger.info(f"Starting Phase {phase.name}: {len(p_courses)} courses")
            
            # Dynamic timeouts based on phase complexity
            base_timeout = 30 + (len(p_courses) * 2)
            if phase == SchedulingPhase.GEC_MAT: base_timeout += 60
            if phase == SchedulingPhase.PE: base_timeout += 60 
            if phase == SchedulingPhase.MAJORS_Y3: base_timeout += 90
            
            p_sched = self.solve_phase_logic(p_courses, phase, base_timeout)
            
            if p_sched is None:
                logger.error(f"Failed Phase {phase.name}")
                return "impossible"
                
            combined_schedule.extend(p_sched)
            self.update_progress(50 + int((i / total_p) * 45))
            
        # NOTE: Internal tracking keys (_start_slot, _duration, _room_type,
        # _room_idx) are intentionally kept here so that FacultyAssigner can
        # use them for double-booking detection.  They are stripped in
        # generate_schedule() after faculty assignment is complete.
        return combined_schedule

    def solve_phase_logic(self, phase_courses, phase, timeout):
        model = cp_model.CpModel()
        solver = cp_model.CpSolver()
        
        phase_sessions = []
        section_intervals = defaultdict(list)
        room_intervals = defaultdict(list)

        # Collected (BoolVar, int_weight) pairs from soft-placement patterns.
        # Minimising their weighted sum encodes "prefer but don't enforce".
        # The list stays empty for phases that have no template courses, so
        # no objective is added and the solver runs as a pure feasibility check.
        penalty_terms: List[Tuple] = []
        
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
            sessions = self.create_course_sessions(
                model, course, section_intervals, room_intervals, penalty_terms
            )
            if sessions is None: return None
            phase_sessions.extend(sessions)

        # Apply Global Non-Overlap Constraints
        for ints in section_intervals.values(): model.AddNoOverlap(ints)
        for ints in room_intervals.values(): model.AddNoOverlap(ints)
        
        self.add_room_consistency(model, phase_sessions)

        # Soft objective: minimise weighted placement penalties.
        # Using Minimize keeps the problem feasible even when every preferred
        # day is unavailable — the solver simply pays the penalty cost.
        if penalty_terms:
            p_vars   = [pv for pv, _ in penalty_terms]
            p_weights = [pw for _, pw in penalty_terms]
            model.Minimize(cp_model.LinearExpr.WeightedSum(p_vars, p_weights))
        
        solver.parameters.max_time_in_seconds = float(timeout)
        solver.parameters.num_search_workers = 8
        
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

    def create_course_sessions(self, model, course, section_intervals, room_intervals,
                               penalty_terms: Optional[List] = None):
        """
        Main session-creation dispatcher.

        Reads the optional ``schedulingPattern`` field on the course document:

        * ``'mirrored'``  – 2 sessions/week, same intra-day time on a
                            Monday/Tuesday or Thursday/Friday pair (hard).
        * ``'blocked'``   – all sessions on the same day, strictly back-to-back
                            (hard), with a strong soft preference for Wednesday
                            or Saturday (soft, never causes INFEASIBLE).
        * absent / other  – legacy behaviour unchanged.
        """
        if penalty_terms is None:
            penalty_terms = []

        code = course["courseCode"]
        title = course['title'].upper()
        
        is_practicum = "PRACTICUM" in title or "422" in code or "131" in code
        if is_practicum:
            return self.create_practicum_sessions(model, course, section_intervals)

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

        # ── Template / Blueprint patterns ────────────────────────────────────
        pattern = course.get('schedulingPattern', '').lower().strip()

        if pattern == 'mirrored':
            # Two equal sessions on a consecutive day-pair at the same time.
            # Works for lecture-only, lab-only, or both (each treated separately).
            for blk in block_letters:
                if lec_u > 0:
                    dur = int(lec_u * 2)           # total half-hour slots
                    per_sess = max(1, dur // 2)    # split evenly across 2 days
                    sess = self.create_mirrored_sessions(
                        model, course, blk, 'lecture', per_sess,
                        section_intervals, room_intervals
                    )
                    if sess is None: return None
                    all_sess.extend(sess)
                if lab_u > 0:
                    dur = int(lab_u * 6)
                    per_sess = max(1, dur // 2)
                    sess = self.create_mirrored_sessions(
                        model, course, blk, 'lab', per_sess,
                        section_intervals, room_intervals
                    )
                    if sess is None: return None
                    all_sess.extend(sess)
            for blk in block_letters:
                blk_sess = [x for x in all_sess if x['blk'] == blk]
                if blk_sess: self.add_daily_limits(model, blk_sess)
            return all_sess

        if pattern == 'blocked':
            # All sessions for a block grouped on one day, back-to-back.
            # Soft preference for Wed/Sat is encoded as a minimisation penalty.
            for blk in block_letters:
                if lec_u > 0:
                    total = int(lec_u * 2)
                    count = 2 if total > 3 else 1
                    dur   = total // count
                    durations = [dur] * count
                    sess = self.create_blocked_sessions(
                        model, course, blk, 'lecture', durations,
                        section_intervals, room_intervals, penalty_terms
                    )
                    if sess is None: return None
                    all_sess.extend(sess)
                if lab_u > 0:
                    total = int(lab_u * 6) if lab_u > 1 else 6
                    count = 2; dur = total // count
                    durations = [dur] * count
                    sess = self.create_blocked_sessions(
                        model, course, blk, 'lab', durations,
                        section_intervals, room_intervals, penalty_terms
                    )
                    if sess is None: return None
                    all_sess.extend(sess)
            for blk in block_letters:
                blk_sess = [x for x in all_sess if x['blk'] == blk]
                if blk_sess: self.add_daily_limits(model, blk_sess)
            return all_sess
        # ── End template patterns ─────────────────────────────────────────────

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

    def create_practicum_sessions(self, model, course, section_intervals):
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
                all_practicum_sess.append({
                    'id': sid, 'code': code, 'title': course['title'], 
                    'prog': course['program'], 'yr': course['yearLevel'], 
                    'blk': blk, 'type': 'practicum', 
                    'start': s, 'end': e, 'day': d, 'room': None, 
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
                rv = model.NewIntVarFromDomain(cp_model.Domain.FromValues(r_indices), f"r_sh_{sid}")
                for rid in r_indices:
                    lit = model.NewBoolVar(f"u_sh_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit); model.Add(rv != rid).OnlyEnforceIf(lit.Not())
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

    # ══════════════════════════════════════════════════════════════════════════
    # TEMPLATE / BLUEPRINT PATTERN HELPERS
    # ══════════════════════════════════════════════════════════════════════════

    def create_mirrored_sessions(
        self, model, course, blk: str, sess_type: str, duration_slots: int,
        section_intervals, room_intervals
    ):
        """
        Hard-constraint "Mirrored" blueprint.

        Produces exactly **2** sessions for *blk* that satisfy ALL of:

        1. Days are a consecutive pair — either Mon/Tue (indices 0 & 1) or
           Thu/Fri (indices 3 & 4).  Both orderings are accepted so the solver
           can pick whichever fits resource availability.
        2. Both sessions start at the **same intra-day slot offset**
           (i.e. ``start % slots_per_day`` is identical).
        3. The same room is reused on both days (consistent room rule).

        Falls back to a regular 2-session ``create_constrained_session`` call
        (with a logged warning) if the week has fewer than 5 days configured —
        e.g. a Mon–Fri only calendar that lacks Saturday — so the Thu/Fri pair
        is partially out of range.
        """
        code = course['courseCode']
        prog = course['program']
        yr   = course['yearLevel']
        sk   = (prog, yr, blk)
        occupied = self.section_occupied.get(sk, set())

        n_days = len(self.days)

        # Build the allowed (day_A, day_B) pairs that are within calendar range.
        candidate_pairs = [(0, 1), (1, 0), (3, 4), (4, 3)]
        valid_pairs = [(a, b) for (a, b) in candidate_pairs
                       if a < n_days and b < n_days]

        if not valid_pairs:
            logger.warning(
                "Mirrored %s %s: no valid consecutive day-pairs in a %d-day "
                "week — falling back to standard 2-session scheduling.",
                code, blk, n_days
            )
            return self.create_constrained_session(
                model, course, blk, sess_type, 2, duration_slots,
                section_intervals, room_intervals,
                False, False, False, force_online=False
            )

        domain = self.get_valid_domain(
            course, sess_type, duration_slots, occupied,
            False, False, False, False
        )
        if not domain:
            logger.error("Mirrored %s %s (%s): empty slot domain.", code, blk, sess_type)
            return None

        sid1 = self._get_next_schedule_id()
        sid2 = self._get_next_schedule_id()

        # ── Day variables ────────────────────────────────────────────────────
        d1 = model.NewIntVar(0, n_days - 1, f"d_mir1_{sid1}")
        d2 = model.NewIntVar(0, n_days - 1, f"d_mir2_{sid2}")
        model.AddAllowedAssignments([d1, d2], valid_pairs)

        # ── Start / end variables ────────────────────────────────────────────
        dom = cp_model.Domain.FromValues(domain)
        s1 = model.NewIntVarFromDomain(dom, f"s_mir1_{sid1}")
        s2 = model.NewIntVarFromDomain(dom, f"s_mir2_{sid2}")
        e1 = model.NewIntVar(duration_slots, self.total_inc, f"e_mir1_{sid1}")
        e2 = model.NewIntVar(duration_slots, self.total_inc, f"e_mir2_{sid2}")

        model.Add(e1 == s1 + duration_slots)
        model.Add(e2 == s2 + duration_slots)

        # Anchor each start to its day
        model.Add(s1 >= d1 * self.slots_per_day)
        model.Add(s1 <  (d1 + 1) * self.slots_per_day)
        model.Add(s2 >= d2 * self.slots_per_day)
        model.Add(s2 <  (d2 + 1) * self.slots_per_day)

        # ── Same intra-day offset (the "mirror" constraint) ──────────────────
        off1 = model.NewIntVar(0, self.slots_per_day - 1, f"off_mir1_{sid1}")
        off2 = model.NewIntVar(0, self.slots_per_day - 1, f"off_mir2_{sid2}")
        model.AddModuloEquality(off1, s1, self.slots_per_day)
        model.AddModuloEquality(off2, s2, self.slots_per_day)
        model.Add(off1 == off2)

        # ── Section non-overlap intervals ────────────────────────────────────
        iv1 = model.NewIntervalVar(s1, duration_slots, e1, f"iv_mir1_{sid1}")
        iv2 = model.NewIntervalVar(s2, duration_slots, e2, f"iv_mir2_{sid2}")
        section_intervals[sk].append(iv1)
        section_intervals[sk].append(iv2)

        # ── Room allocation — same room reused on both days ──────────────────
        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices   = list(range(len(rooms_avail)))
        rv1 = rv2 = None

        if rooms_avail:
            rv1 = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(r_indices), f"r_mir1_{sid1}"
            )
            rv2 = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(r_indices), f"r_mir2_{sid2}"
            )
            # Consistent room across both mirror days
            model.Add(rv1 == rv2)

            for rid in r_indices:
                lit1 = model.NewBoolVar(f"u_mir1_{sid1}_{rid}")
                model.Add(rv1 == rid).OnlyEnforceIf(lit1)
                model.Add(rv1 != rid).OnlyEnforceIf(lit1.Not())
                room_intervals[(sess_type.lower(), rid)].append(
                    model.NewOptionalIntervalVar(
                        s1, duration_slots, e1, lit1, f"opt_mir1_{sid1}_{rid}"
                    )
                )
                lit2 = model.NewBoolVar(f"u_mir2_{sid2}_{rid}")
                model.Add(rv2 == rid).OnlyEnforceIf(lit2)
                model.Add(rv2 != rid).OnlyEnforceIf(lit2.Not())
                room_intervals[(sess_type.lower(), rid)].append(
                    model.NewOptionalIntervalVar(
                        s2, duration_slots, e2, lit2, f"opt_mir2_{sid2}_{rid}"
                    )
                )

        base = {
            'code': code, 'title': course['title'],
            'prog': prog, 'yr': yr, 'blk': blk,
            'type': sess_type, 'duration': duration_slots,
        }
        return [
            {**base, 'id': sid1, 'start': s1, 'end': e1, 'day': d1, 'room': rv1},
            {**base, 'id': sid2, 'start': s2, 'end': e2, 'day': d2, 'room': rv2},
        ]

    # ─────────────────────────────────────────────────────────────────────────

    def create_blocked_sessions(
        self, model, course, blk: str, sess_type: str,
        session_durations: List[int],
        section_intervals, room_intervals,
        penalty_terms: List[Tuple]
    ):
        """
        Hard-structure + Soft-placement "Blocked" blueprint.

        **Hard rules (always enforced):**

        * All *n* sessions share the **same day** variable ``d``.
        * They are placed **strictly back-to-back**: session *i* starts exactly
          where session *i-1* ends.  This is expressed as fixed arithmetic
          offsets from a single anchor start variable so the solver never needs
          to search for the gap between sessions.

        **Soft rule (never causes INFEASIBLE):**

        * The block is strongly preferred on Wednesday (index 2) or Saturday
          (index 5).  A ``BoolVar`` penalty is appended to *penalty_terms* with
          weight 100.  The caller's ``solve_phase_logic`` minimises the total
          weighted penalty, so the solver *gravitates* towards preferred days
          but is free to use any other day when those are unavailable.

        **Room consistency:** all sub-sessions in the block share the same room
        variable (and therefore the same physical room).
        """
        code = course['courseCode']
        prog = course['program']
        yr   = course['yearLevel']
        sk   = (prog, yr, blk)
        occupied  = self.section_occupied.get(sk, set())
        n         = len(session_durations)
        total_dur = sum(session_durations)
        n_days    = len(self.days)

        if n == 0:
            return []

        # Domain for the *anchor* (first session's start): the entire block
        # of ``total_dur`` slots must fit within a single day without
        # overlapping already-occupied slots.
        domain = self.get_valid_domain(
            course, sess_type, total_dur, occupied,
            False, False, False, False
        )
        if not domain:
            logger.error(
                "Blocked %s %s (%s): no valid anchor slot for a %d-slot block.",
                code, blk, sess_type, total_dur
            )
            return None

        anchor_sid = self._get_next_schedule_id()

        # ── Shared day variable ───────────────────────────────────────────────
        d = model.NewIntVar(0, n_days - 1, f"d_blk_{anchor_sid}")

        # ── Soft preferred-day penalty ────────────────────────────────────────
        # Preferred days: Wednesday = 2, Saturday = 5
        preferred_indices = [i for i in (2, 5) if i < n_days]

        if preferred_indices:
            # Build one BoolVar per preferred day: b_pd == (d == pd)
            day_match_bools = []
            for pd in preferred_indices:
                b = model.NewBoolVar(f"is_day{pd}_blk_{anchor_sid}")
                model.Add(d == pd).OnlyEnforceIf(b)
                model.Add(d != pd).OnlyEnforceIf(b.Not())
                day_match_bools.append(b)

            # is_preferred == OR(day_match_bools)
            # Encoded via:  is_preferred → at least one match is true
            #               any match true → is_preferred
            is_preferred = model.NewBoolVar(f"is_pref_blk_{anchor_sid}")
            model.AddBoolOr(day_match_bools + [is_preferred.Not()])
            for b in day_match_bools:
                model.AddImplication(b, is_preferred)

            # not_on_preferred = 1 − is_preferred  (== is_preferred.Not())
            # Appending (is_preferred.Not(), weight) means the objective pays
            # `weight` whenever the block lands on a non-preferred day.
            penalty_terms.append((is_preferred.Not(), 100))
        else:
            logger.debug(
                "Blocked %s %s: no preferred days available in a %d-day week; "
                "day penalty skipped.", code, blk, n_days
            )

        # ── Anchor start variable ────────────────────────────────────────────
        dom       = cp_model.Domain.FromValues(domain)
        s_anchor  = model.NewIntVarFromDomain(dom, f"s_blk_{anchor_sid}")

        # Anchor must belong to day d and the *entire* block must fit within it
        model.Add(s_anchor >= d * self.slots_per_day)
        model.Add(s_anchor + total_dur <= (d + 1) * self.slots_per_day)

        # ── Room variable — shared across all sub-sessions ───────────────────
        rooms_avail = self.normalized_rooms.get(sess_type.lower(), [])
        r_indices   = list(range(len(rooms_avail)))
        rv = None
        if rooms_avail:
            rv = model.NewIntVarFromDomain(
                cp_model.Domain.FromValues(r_indices), f"r_blk_{anchor_sid}"
            )

        # ── Build back-to-back sub-sessions ──────────────────────────────────
        created    = []
        cum_offset = 0          # running sum of durations before session i

        for i, dur in enumerate(session_durations):
            sid = anchor_sid if i == 0 else self._get_next_schedule_id()

            # s_i is deterministically offset from the anchor — no gap possible
            s = model.NewIntVar(0, self.total_inc - dur, f"s_blki_{sid}")
            e = model.NewIntVar(dur, self.total_inc,     f"e_blki_{sid}")
            model.Add(s == s_anchor + cum_offset)
            model.Add(e == s + dur)

            iv = model.NewIntervalVar(s, dur, e, f"iv_blk_{sid}")
            section_intervals[sk].append(iv)

            # Register optional room intervals so AddNoOverlap works globally
            if rv is not None:
                for rid in r_indices:
                    lit = model.NewBoolVar(f"u_blk_{sid}_{i}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit)
                    model.Add(rv != rid).OnlyEnforceIf(lit.Not())
                    room_intervals[(sess_type.lower(), rid)].append(
                        model.NewOptionalIntervalVar(
                            s, dur, e, lit, f"opt_blk_{sid}_{i}_{rid}"
                        )
                    )

            created.append({
                'id': sid, 'code': code, 'title': course['title'],
                'prog': prog, 'yr': yr, 'blk': blk,
                'type': sess_type, 'duration': dur,
                'start': s, 'end': e, 'day': d, 'room': rv,
            })
            cum_offset += dur

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
                rv = model.NewIntVarFromDomain(cp_model.Domain.FromValues(r_indices), f"r_{sid}")
                for rid in r_indices:
                    lit = model.NewBoolVar(f"u_{sid}_{rid}")
                    model.Add(rv == rid).OnlyEnforceIf(lit); model.Add(rv != rid).OnlyEnforceIf(lit.Not())
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
            r_name = "online"; r_type = s['type']; r_idx = -1
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

def generate_schedule(process_id=None, semester=None):
    try:
        s = HierarchicalScheduler(process_id)
        s.load_data(semester_filter=semester)
        res = s.solve()
        if res == "impossible": 
            logger.error("Schedule generation failed: Impossible Constraints")
            return "impossible"

        # ── Faculty assignment ────────────────────────────────────────────────
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

        # ── Strip internal tracking keys now that assignment is done ──────────
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