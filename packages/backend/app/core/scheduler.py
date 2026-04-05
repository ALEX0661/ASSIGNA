from ortools.sat.python import cp_model
from app.core.firebase import db, get_courses, get_faculty, get_rooms, get_time, get_days
from app.core.globals import schedule_dict, progress_state, faculty_occupied
from collections import defaultdict

class HierarchicalScheduler:
    def __init__(self, process_id=None):
        self.process_id = process_id
        self.occupied_slots = defaultdict(set)
        self.all_courses = []
        self.all_faculty = []
        self.rooms = {}
        self.days = []
        self.slots_per_day = 0

    def load_data(self):
        self.all_courses = get_courses()
        self.all_faculty = get_faculty()
        self.rooms = get_rooms()
        raw_days = get_days()
        self.days = raw_days if raw_days else ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
        time_settings = get_time()
        start = time_settings.get("start_time", 7)
        end   = time_settings.get("end_time", 21)
        self.slots_per_day = int((end - start) / 0.5)
        self.total_slots = self.slots_per_day * len(self.days)

    def get_phase(self, course):
        code = course.get("courseCode", "")
        year = course.get("yearLevel", 1)
        if "NSTP" in code: return 1
        if code.startswith("GEC") or code.startswith("MAT"): return 2
        if year == 4: return 3
        if year == 3: return 4
        if year == 2: return 5
        if year == 1: return 6
        if "PE" in code or "PATHFIT" in code: return 7
        return 6

    def solve(self):
        combined = []
        phases = sorted(set(self.get_phase(c) for c in self.all_courses))
        for phase_num in phases:
            phase_courses = [c for c in self.all_courses
                             if self.get_phase(c) == phase_num]
            if not phase_courses:
                continue
            result = self.solve_phase(phase_courses, phase_num)
            if result == "impossible":
                return "impossible"
            combined.extend(result)
            if self.process_id:
                progress_state[self.process_id] = int((phase_num / 7) * 100)
        return combined

    def solve_phase(self, courses, phase_num):
        model = cp_model.CpModel()
        sessions = []

        for course in courses:
            code  = course.get("courseCode", "")
            blocks = course.get("blocks", 1)
            lec_units = course.get("unitsLecture", 3)
            lab_units = course.get("unitsLab", 0)
            program = course.get("program", "")

            for blk_idx in range(blocks):
                blk = chr(65 + blk_idx)

                if lec_units > 0:
                    duration = int(lec_units * 2)
                    start_var = model.NewIntVar(0, self.total_slots - duration, f"s_{code}_{blk}_lec")
                    end_var   = model.NewIntVar(0, self.total_slots, f"e_{code}_{blk}_lec")
                    interval  = model.NewIntervalVar(start_var, duration, end_var, f"i_{code}_{blk}_lec")
                    sessions.append({
                        "start_var": start_var,
                        "duration": duration,
                        "interval": interval,
                        "courseCode": code,
                        "program": program,
                        "block": blk,
                        "session": "Lecture",
                        "title": course.get("title", code),
                        "year": course.get("yearLevel", 1),
                    })

                if lab_units > 0:
                    duration = int(lab_units * 2)
                    start_var = model.NewIntVar(0, self.total_slots - duration, f"s_{code}_{blk}_lab")
                    end_var   = model.NewIntVar(0, self.total_slots, f"e_{code}_{blk}_lab")
                    interval  = model.NewIntervalVar(start_var, duration, end_var, f"i_{code}_{blk}_lab")
                    sessions.append({
                        "start_var": start_var,
                        "duration": duration,
                        "interval": interval,
                        "courseCode": code,
                        "program": program,
                        "block": blk,
                        "session": "Laboratory",
                        "title": course.get("title", code),
                        "year": course.get("yearLevel", 1),
                    })

        # No-overlap constraint
        model.AddNoOverlap([s["interval"] for s in sessions])

        # Block existing occupied slots
        for slot_start in [s for group in self.occupied_slots.values() for s in group]:
            b_start = model.NewIntVar(slot_start, slot_start, "")
            b_end   = model.NewIntVar(slot_start + 1, slot_start + 1, "")
            model.NewIntervalVar(b_start, 1, b_end, "")

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30 + len(courses) * 2
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return "impossible"

        results = []
        for s in sessions:
            slot = solver.Value(s["start_var"])
            day_idx  = slot // self.slots_per_day
            slot_idx = slot %  self.slots_per_day
            start_hr = 7 + slot_idx * 0.5
            end_hr   = start_hr + s["duration"] * 0.5
            def fmt(h): return f"{int(h)}:{'30' if h%1 else '00'} {'AM' if h<12 else 'PM'}"
            day_name = self.days[day_idx] if day_idx < len(self.days) else "Monday"
            self.occupied_slots["main"].add(slot)
            results.append({
                "courseCode": s["courseCode"],
                "title": s["title"],
                "program": s["program"],
                "year": s["year"],
                "session": s["session"],
                "block": s["block"],
                "day": day_name,
                "period": f"{fmt(start_hr)} - {fmt(end_hr)}",
                "room": "TBA",
                "faculty": "TBA",
                "assignmentScore": None,
                "facultyAutoAssigned": False,
            })

        return results


def generate_schedule(process_id=None):
    from app.core.globals import schedule_dict, progress_state
    scheduler = HierarchicalScheduler(process_id)
    scheduler.load_data()
    result = scheduler.solve()
    if result == "impossible":
        if process_id:
            progress_state[process_id] = -1
        return
    schedule_dict.clear()
    schedule_dict.extend(result)
    if process_id:
        progress_state[process_id] = 100