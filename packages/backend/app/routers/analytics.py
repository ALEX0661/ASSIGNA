from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.globals import schedule_dict
from app.core.firebase import get_faculty, get_courses, get_rooms
from app.core.unit_balancing import evaluate_workload

router = APIRouter()


# ── Shared helpers ────────────────────────────────────────────────────────────

def _extract_course_titles(specializations) -> set[str]:
    """
    Extract the set of normalised courseTitle strings from a faculty member's
    specializations.  courseTitle is the stable match key — it survives course
    code reassignments.

    Falls back to courseCode for legacy entries that predate the title-based
    system (i.e. entries with no courseTitle field).
    """
    titles: set[str] = set()
    if isinstance(specializations, str):
        # Very old format: comma-separated code string — treat codes as titles
        for s in specializations.split(","):
            t = s.strip()
            if t:
                titles.add(t.lower())
    elif isinstance(specializations, list):
        for item in specializations:
            if isinstance(item, dict):
                ct = (item.get("courseTitle") or "").strip()
                if ct:
                    titles.add(ct.lower())
                else:
                    # Legacy fallback
                    cc = (item.get("courseCode") or "").strip()
                    if cc:
                        titles.add(cc.lower())
            elif isinstance(item, str) and item.strip():
                titles.add(item.strip().lower())
    return titles


def _extract_course_codes(specializations) -> set[str]:
    """
    Legacy helper — extracts raw courseCode strings.
    Retained for backward-compatible callers; new code should use
    _extract_course_titles() instead.
    """
    codes: set[str] = set()
    if isinstance(specializations, str):
        codes = {s.strip() for s in specializations.split(",") if s.strip()}
    elif isinstance(specializations, list):
        for item in specializations:
            if isinstance(item, dict):
                code = item.get("courseCode", "")
                if code:
                    codes.add(str(code).strip())
            elif isinstance(item, str) and item.strip():
                codes.add(item.strip())
    return codes


def _get_active_faculty() -> list:
    """Return only non-archived faculty members."""
    return [f for f in get_faculty() if not f.get("archived", False)]


_OTHER_DEPT_PREFIXES = ("GEC", "MAT", "MATH", "NSTP", "PATHFIT", "PE")

def _is_other_dept(course_code: str) -> bool:
    upper = (course_code or "").strip().upper()
    return any(upper.startswith(p) for p in _OTHER_DEPT_PREFIXES)


def _parse_time(raw: str):
    import re
    if not raw:
        return None
    raw = raw.strip()
    m = re.match(r'^(\d{1,2}):(\d{2})\s*(AM|PM)?$', raw, re.IGNORECASE)
    if not m:
        return None
    h, mn, meridiem = int(m.group(1)), int(m.group(2)), (m.group(3) or "").upper()
    if meridiem == "PM" and h != 12:
        h += 12
    elif meridiem == "AM" and h == 12:
        h = 0
    return h * 60 + mn


def _parse_slot(slot: str):
    import re
    if not slot:
        return None
    parts = re.split(r'(?<=[\dMmPpAa])\s*[-–]\s*(?=\d)', slot.strip(), maxsplit=1)
    if len(parts) != 2:
        return None
    start = _parse_time(parts[0])
    end   = _parse_time(parts[1])
    if start is None or end is None:
        return None
    if end <= start:
        end += 24 * 60
    return (start, end)


def _slots_overlap(a, b) -> bool:
    if a is None or b is None:
        return False
    return a[0] < b[1] and b[0] < a[1]


def _are_merge_partners(ea: dict, eb: dict) -> bool:
    if not ea or not eb:
        return False
    if (ea.get("courseCode") and ea.get("courseCode") == eb.get("courseCode") and
            ea.get("program") and ea.get("program") == eb.get("program") and
            str(ea.get("year", "")) == str(eb.get("year", "")) and
            ea.get("block") != eb.get("block") and
            ea.get("room") and ea.get("room") != "TBA" and ea.get("room") == eb.get("room") and
            ea.get("day") and ea.get("day") == eb.get("day") and
            ea.get("period") and ea.get("period") == eb.get("period")):
        return True
    import re as _re
    def _base(s): return _re.sub(r'-[A-Z]$', '', str(s or ''))
    def _has(s):  return bool(_re.search(r'-[A-Z]$', str(s or '')))
    sa, sb = str(ea.get("schedule_id") or ""), str(eb.get("schedule_id") or "")
    if _has(sa) and _has(sb) and _base(sa) == _base(sb):
        return True
    return False


def _count_conflicts(events: list) -> int:
    from collections import defaultdict
    room_sessions:    dict = defaultdict(list)
    faculty_sessions: dict = defaultdict(list)
    conflict_ids:     set  = set()

    for e in events:
        eid = str(
            e.get("schedule_id") or e.get("id") or
            f"{e.get('courseCode','')}-{e.get('block','')}-{e.get('session','')}-{e.get('day','')}"
        ).strip("-")
        if not eid:
            continue
        day  = (e.get("day",    "") or "").strip()
        slot = (e.get("period", "") or e.get("timeSlot", "") or e.get("time", "") or "").strip()
        room = (e.get("room",   "") or "").strip()
        fac  = (e.get("faculty","") or "").strip()
        parsed = _parse_slot(slot)
        if room and room.upper() != "TBA":
            room_sessions[(day, room)].append((parsed, slot, eid, e))
        if fac and fac.upper() != "TBA":
            faculty_sessions[(day, fac)].append((parsed, slot, eid, e))

    def _mark_conflicts(sessions_map: dict) -> None:
        for sessions in sessions_map.values():
            n = len(sessions)
            for i in range(n):
                parsed_i, slot_i, eid_i, ev_i = sessions[i]
                for j in range(i + 1, n):
                    parsed_j, slot_j, eid_j, ev_j = sessions[j]
                    if eid_i == eid_j:
                        continue
                    if _are_merge_partners(ev_i, ev_j):
                        continue
                    if parsed_i is not None and parsed_j is not None:
                        if _slots_overlap(parsed_i, parsed_j):
                            conflict_ids.add(eid_i)
                            conflict_ids.add(eid_j)
                    else:
                        if slot_i and slot_i == slot_j:
                            conflict_ids.add(eid_i)
                            conflict_ids.add(eid_j)

    _mark_conflicts(room_sessions)
    _mark_conflicts(faculty_sessions)
    return len(conflict_ids)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/assignment-quality")
def assignment_quality(user=Depends(admin_only)):
    """Post-solve analytics: auto-assign rate, avg score, preference compliance."""
    if not schedule_dict:
        return {
            "totalSessions":      0,
            "autoAssigned":       0,
            "tbaSessions":        0,
            "autoAssignPct":      0,
            "avgScore":           None,
            "totalConflicts":     0,
            "pctInWindow":        None,
            "pctOnPreferredDays": None,
            "perFaculty":         [],
        }

    all_events = list(schedule_dict.values())
    total    = len(all_events)
    events   = [e for e in all_events if not _is_other_dept(e.get("courseCode", ""))]
    auto     = [e for e in events if e.get("facultyAutoAssigned")]
    tba      = [e for e in events if e.get("faculty") == "TBA"]
    scored   = [e for e in events if e.get("assignmentScore") is not None]
    in_win   = [e for e in scored  if e.get("assignmentScore", 0) >= 0.6]
    on_day   = [e for e in scored  if e.get("assignmentScore", 0) >= 0.7]

    avg_score = (
        round(sum(e["assignmentScore"] for e in scored) / len(scored), 2)
        if scored else None
    )

    fac_map: dict[str, dict] = {}
    for e in events:
        name = e.get("faculty", "TBA")
        if name == "TBA":
            continue
        entry = fac_map.setdefault(name, {"sessions": 0, "scores": []})
        entry["sessions"] += 1
        sc = e.get("assignmentScore")
        if sc is not None:
            entry["scores"].append(sc)

    per_faculty = [
        {
            "name":     name,
            "sessions": info["sessions"],
            "avgScore": round(sum(info["scores"]) / len(info["scores"]), 2) if info["scores"] else None,
        }
        for name, info in fac_map.items()
    ]

    total_conflicts = _count_conflicts(all_events)

    return {
        "totalSessions":      total,
        "majorSessions":      len(events),
        "autoAssigned":       len(auto),
        "tbaSessions":        len(tba),
        "autoAssignPct":      round(len(auto) / len(events) * 100, 1) if events else 0,
        "avgScore":           avg_score,
        "totalConflicts":     total_conflicts,
        "pctInWindow":        round(len(in_win) / len(scored) * 100, 1) if scored else None,
        "pctOnPreferredDays": round(len(on_day) / len(scored) * 100, 1) if scored else None,
        "perFaculty":         per_faculty,
    }


@router.get("/faculty-preview")
def faculty_preview(user=Depends(admin_only)):
    """Pre-solve check: eligible faculty count per course, matched by courseTitle."""
    from app.core.firebase import get_courses
    courses = get_courses()
    faculty = _get_active_faculty()

    # Build title → faculty pool map (title is the stable match key)
    title_pool: dict[str, list[str]] = {}
    for f in faculty:
        f_name = f.get("name", "Unknown")
        titles = _extract_course_titles(f.get("specializations", []))
        for title in titles:
            title_pool.setdefault(title, []).append(f_name)

    result = []
    for course in courses:
        code  = course.get("courseCode", "")
        title = (course.get("title") or "").strip()
        # Match by normalised title; fall back to code lookup for legacy data
        pool = title_pool.get(title.lower(), title_pool.get(code.lower(), []))
        result.append({
            "courseCode":      code,
            "title":           title,
            "poolSize":        len(pool),
            "eligibleFaculty": pool,
            "warning":         len(pool) == 0,
        })

    return {"courses": result}


@router.get("/workload")
def workload(user=Depends(admin_only)):
    """
    Faculty workload summary with enhanced load_reason narrative.

    Each row now includes:
      - load_reason  : human-readable explanation of why the load is high/normal
      - load_pct     : assigned / effective_max as a 0-100 percentage
      - courses_detail: list of distinct course codes being taught (for tooltip)
    """
    faculty_list = _get_active_faculty()
    rows = evaluate_workload(faculty_list, schedule_dict)

    # Augment each row with extra interpretation fields
    for row in rows:
        assigned     = row["assigned"]
        effective_max = row["effective_max"]
        status       = row.get("status", "full-time")
        courses      = row.get("distinct_courses", 0)
        overloaded   = row.get("overloaded", False)

        # Percentage utilisation (0–100+)
        row["load_pct"] = round((assigned / effective_max * 100), 1) if effective_max else 0

        # Human-readable explanation
        row["load_reason"] = _build_load_reason(
            name=row["name"],
            assigned=assigned,
            effective_max=effective_max,
            status=status,
            courses=courses,
            overloaded=overloaded,
        )

    # Also attach the list of distinct course codes per faculty from schedule_dict
    faculty_courses = _build_faculty_course_list()
    for row in rows:
        row["course_list"] = sorted(faculty_courses.get(row["name"], []))

    return {"workload": rows}


def _build_load_reason(
    name: str,
    assigned: float,
    effective_max: float,
    status: str,
    courses: int,
    overloaded: bool,
) -> str:
    """
    Generate a short, human-readable explanation of a faculty member's load.

    Examples:
      "Teaching 5 distinct courses — tiered cap reduced to 18 units (was 24)."
      "Part-time instructor. Cap is fixed at 15 units."
      "Well within capacity at 14 / 24 units (58%)."
      "OVERLOADED: 26 / 24 units. Likely teaching merged sections or extra blocks."
    """
    pct = round(assigned / effective_max * 100) if effective_max else 0

    if overloaded:
        excess = round(assigned - effective_max, 1)
        base = f"OVERLOADED by {excess} units ({pct}% of cap). "
        if courses >= 5:
            base += (
                f"Teaching {courses} distinct courses — cap is already at its lowest tier "
                f"(18 units) but assignments still exceed it. Check for extra blocks or merged sections."
            )
        else:
            base += (
                f"Teaching {courses} course(s). "
                "Possible cause: merged sections that were each counted separately, "
                "or late manual assignments bypassing the unit cap."
            )
        return base

    if status.lower() == "part-time":
        if pct >= 90:
            return (
                f"Part-time instructor at {pct}% of the 15-unit cap ({assigned} / 15 units). "
                "Near maximum — avoid adding more sessions."
            )
        return (
            f"Part-time instructor. Assigned {assigned} of 15 allowed units ({pct}%). "
            "Cap is fixed regardless of course count."
        )

    if courses >= 5:
        return (
            f"Teaching {courses} distinct courses — tiered cap is 18 units. "
            f"Currently at {assigned} / 18 units ({pct}%). "
            "High course variety is the primary driver of the reduced cap."
        )
    if courses >= 3:
        return (
            f"Teaching {courses} distinct courses — tiered cap is 21 units. "
            f"Currently at {assigned} / 21 units ({pct}%). "
            "Moderate course spread keeps the cap in the middle tier."
        )
    if pct >= 85:
        return (
            f"Approaching capacity: {assigned} / {effective_max} units ({pct}%). "
            f"Teaching {courses} course(s). Consider this before adding more sessions."
        )
    if pct <= 30:
        return (
            f"Light load: {assigned} / {effective_max} units ({pct}%). "
            f"Teaching {courses} course(s). Has significant headroom available."
        )

    return (
        f"Normal load: {assigned} / {effective_max} units ({pct}%). "
        f"Teaching {courses} distinct course(s)."
    )


def _build_faculty_course_list() -> dict[str, list[str]]:
    """Return {faculty_name: [courseCode, ...]} from the live schedule."""
    from collections import defaultdict
    result: dict[str, set[str]] = defaultdict(set)
    for ev in schedule_dict.values():
        name = ev.get("faculty", "TBA")
        code = ev.get("courseCode", "")
        if name != "TBA" and code:
            result[name].add(code)
    return {k: sorted(v) for k, v in result.items()}


# ── NEW: Schedule distribution endpoint ───────────────────────────────────────

@router.get("/schedule-distribution")
def schedule_distribution(user=Depends(admin_only)):
    """
    Aggregate statistics for rich analytics charts.

    Returns:
      byProgram      : [{ program, sessions, lectureCount, labCount, tbaSessions }]
      byDay          : [{ day, sessions }]  — ordered Mon → Sat
      byType         : [{ type, count }]    — "Lecture" / "Lab" / "Other"
      byYearLevel    : [{ yearLevel, sessions }]
      roomUtilisation: [{ room, sessions }] — top 15 rooms
      facultyCoverage: { covered, tba, total, pct }
      peakDay        : str
      peakProgram    : str
    """
    if not schedule_dict:
        return _empty_distribution()

    all_events = list(schedule_dict.values())

    # ── By program ────────────────────────────────────────────────────────────
    from collections import defaultdict
    prog_map: dict[str, dict] = defaultdict(lambda: {
        "sessions": 0, "lectureCount": 0, "labCount": 0, "tbaSessions": 0
    })
    for e in all_events:
        prog = e.get("program", "Unknown") or "Unknown"
        prog_map[prog]["sessions"] += 1
        session_type = (e.get("session", "") or "").lower()
        if "lab" in session_type:
            prog_map[prog]["labCount"] += 1
        else:
            prog_map[prog]["lectureCount"] += 1
        if (e.get("faculty", "TBA") or "TBA") == "TBA":
            prog_map[prog]["tbaSessions"] += 1

    by_program = [
        {"program": prog, **data}
        for prog, data in sorted(prog_map.items(), key=lambda x: -x[1]["sessions"])
    ]

    # ── By day ────────────────────────────────────────────────────────────────
    DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_map: dict[str, int] = defaultdict(int)
    for e in all_events:
        day = (e.get("day", "") or "Unknown").strip()
        day_map[day] += 1

    by_day = [
        {"day": d, "sessions": day_map.get(d, 0)}
        for d in DAY_ORDER
        if d in day_map
    ]
    # Append any unexpected day values
    for d, count in day_map.items():
        if d not in DAY_ORDER:
            by_day.append({"day": d, "sessions": count})

    # ── By type ───────────────────────────────────────────────────────────────
    type_map: dict[str, int] = defaultdict(int)
    for e in all_events:
        raw = (e.get("session", "") or "").strip().lower()
        if "lab" in raw:
            type_map["Lab"] += 1
        elif "lec" in raw or "lecture" in raw:
            type_map["Lecture"] += 1
        else:
            type_map["Other"] += 1

    by_type = [{"type": t, "count": c} for t, c in type_map.items() if c > 0]

    # ── By year level ─────────────────────────────────────────────────────────
    year_map: dict[str, int] = defaultdict(int)
    for e in all_events:
        yr = str(e.get("year", e.get("yearLevel", "")) or "Unknown")
        year_map[yr] += 1

    by_year = sorted(
        [{"yearLevel": yr, "sessions": cnt} for yr, cnt in year_map.items()],
        key=lambda x: x["yearLevel"],
    )

    # ── Room utilisation (top 15 physical rooms) ──────────────────────────────
    room_map: dict[str, int] = defaultdict(int)
    for e in all_events:
        room = (e.get("room", "") or "").strip()
        if room and room.upper() not in ("TBA", "ONLINE", ""):
            room_map[room] += 1

    room_utilisation = [
        {"room": r, "sessions": c}
        for r, c in sorted(room_map.items(), key=lambda x: -x[1])[:15]
    ]

    # ── Faculty coverage summary ──────────────────────────────────────────────
    # Exclude other-dept sessions from coverage stats (they're intentionally TBA)
    major_events = [e for e in all_events if not _is_other_dept(e.get("courseCode", ""))]
    covered = sum(1 for e in major_events if (e.get("faculty", "TBA") or "TBA") != "TBA")
    tba_cnt = len(major_events) - covered
    total_m = len(major_events)
    faculty_coverage = {
        "covered": covered,
        "tba":     tba_cnt,
        "total":   total_m,
        "pct":     round(covered / total_m * 100, 1) if total_m else 0,
    }

    # ── Convenience highlights ─────────────────────────────────────────────────
    peak_day     = max(day_map, key=day_map.get, default="N/A") if day_map else "N/A"
    peak_program = max(prog_map, key=lambda p: prog_map[p]["sessions"], default="N/A")

    return {
        "byProgram":       by_program,
        "byDay":           by_day,
        "byType":          by_type,
        "byYearLevel":     by_year,
        "roomUtilisation": room_utilisation,
        "facultyCoverage": faculty_coverage,
        "peakDay":         peak_day,
        "peakProgram":     peak_program,
        "totalSessions":   len(all_events),
    }


def _empty_distribution() -> dict:
    return {
        "byProgram":       [],
        "byDay":           [],
        "byType":          [],
        "byYearLevel":     [],
        "roomUtilisation": [],
        "facultyCoverage": {"covered": 0, "tba": 0, "total": 0, "pct": 0},
        "peakDay":         "N/A",
        "peakProgram":     "N/A",
        "totalSessions":   0,
    }


# ── NEW: Aggregated dashboard stats endpoint ──────────────────────────────────

@router.get("/dashboard-stats")
def dashboard_stats(user=Depends(admin_only)):
    """
    Single aggregated endpoint that powers the entire dashboard UI.

    Reads from in-memory caches (no extra Firestore round-trips) so this
    call is fast even with large datasets.

    Returns course/faculty/room counts broken down in the ways the
    dashboard needs, plus live schedule health data and actionable
    suggestions for the admin.
    """
    from collections import defaultdict

    courses  = get_courses()
    faculty  = get_faculty()
    rooms    = get_rooms()

    # ── Faculty ───────────────────────────────────────────────────────────────
    active_faculty = [f for f in faculty if not f.get("archived", False)]
    full_time  = [f for f in active_faculty if f.get("status", "full-time") == "full-time"]
    part_time  = [f for f in active_faculty if f.get("status", "full-time") == "part-time"]
    with_specs = [f for f in active_faculty if f.get("specializations")]

    faculty_stats = {
        "total":                len(active_faculty),
        "fullTime":             len(full_time),
        "partTime":             len(part_time),
        "withSpecializations":  len(with_specs),
        "withoutSpecializations": len(active_faculty) - len(with_specs),
    }

    # ── Courses ───────────────────────────────────────────────────────────────
    sem_map: dict[str, int] = defaultdict(int)
    prog_map: dict[str, int] = defaultdict(int)
    year_map: dict[int, int] = defaultdict(int)
    total_lec_units = 0
    total_lab_units = 0
    courses_with_lab = 0
    lecture_only     = 0

    for c in courses:
        sem  = c.get("semester", "1st Semester")
        prog = c.get("program",  "Unknown")
        yr   = int(c.get("yearLevel", 1) or 1)
        lec  = int(c.get("unitsLecture", 0) or 0)
        lab  = int(c.get("unitsLab",     0) or 0)

        sem_map[sem]   += 1
        prog_map[prog] += 1
        year_map[yr]   += 1
        total_lec_units += lec
        total_lab_units += lab

        if lab > 0:
            courses_with_lab += 1
        else:
            lecture_only += 1

    course_stats = {
        "total":             len(courses),
        "bySemester":        dict(sem_map),
        "byProgram":         dict(prog_map),
        "byYearLevel":       {str(k): v for k, v in sorted(year_map.items())},
        "totalLectureUnits": total_lec_units,
        "totalLabUnits":     total_lab_units,
        "totalUnits":        total_lec_units + total_lab_units,
        "coursesWithLab":    courses_with_lab,
        "coursesLectureOnly": lecture_only,
    }

    # ── Rooms ─────────────────────────────────────────────────────────────────
    lec_rooms = rooms.get("lecture", []) if isinstance(rooms, dict) else []
    lab_rooms = rooms.get("lab",     []) if isinstance(rooms, dict) else []

    room_stats = {
        "total":        len(lec_rooms) + len(lab_rooms),
        "lecture":      len(lec_rooms),
        "lab":          len(lab_rooms),
        "lectureRooms": lec_rooms,
        "labRooms":     lab_rooms,
    }

    # ── Schedule state ────────────────────────────────────────────────────────
    # We don't import the saved-schedule list here (requires a Firestore call),
    # but we can report whether an in-memory schedule is currently loaded.
    has_live_schedule = bool(schedule_dict)
    total_sessions    = len(schedule_dict)

    schedule_health = {
        "hasLiveSchedule": has_live_schedule,
        "totalSessions":   total_sessions,
        "conflictCount":   _count_conflicts(list(schedule_dict.values())) if has_live_schedule else 0,
    }

    if has_live_schedule:
        # Faculty coverage for the live schedule
        major_events = [
            e for e in schedule_dict.values()
            if not _is_other_dept(e.get("courseCode", ""))
        ]
        covered   = sum(1 for e in major_events if (e.get("faculty", "TBA") or "TBA") != "TBA")
        total_maj = len(major_events)
        schedule_health["coveragePct"] = round(covered / total_maj * 100, 1) if total_maj else 0
        schedule_health["tbaSessions"] = total_maj - covered

        # Workload health
        workload_rows = evaluate_workload(active_faculty, schedule_dict)
        overloaded    = [r for r in workload_rows if r.get("overloaded")]
        near_cap      = [r for r in workload_rows if not r.get("overloaded") and r.get("load_pct", 0) >= 85]
        schedule_health["overloadedCount"] = len(overloaded)
        schedule_health["nearCapCount"]    = len(near_cap)
        schedule_health["overloadedNames"] = [r["name"] for r in overloaded[:5]]
    else:
        schedule_health["coveragePct"]     = 0
        schedule_health["tbaSessions"]     = 0
        schedule_health["overloadedCount"] = 0
        schedule_health["nearCapCount"]    = 0
        schedule_health["overloadedNames"] = []

    # ── Actionable suggestions ────────────────────────────────────────────────
    suggestions = _build_suggestions(
        faculty_stats   = faculty_stats,
        course_stats    = course_stats,
        room_stats      = room_stats,
        schedule_health = schedule_health,
        active_faculty  = active_faculty,
        courses         = courses,
    )

    return {
        "faculty":         faculty_stats,
        "courses":         course_stats,
        "rooms":           room_stats,
        "scheduleHealth":  schedule_health,
        "suggestions":     suggestions,
    }


def _build_suggestions(
    faculty_stats:   dict,
    course_stats:    dict,
    room_stats:      dict,
    schedule_health: dict,
    active_faculty:  list,
    courses:         list,
) -> list[dict]:
    """
    Produce a prioritised list of actionable suggestions for the admin.

    Each suggestion has:
      id        : unique slug for React key
      type      : "error" | "warning" | "info" | "success"
      category  : "faculty" | "courses" | "rooms" | "schedule" | "system"
      title     : short headline
      body      : one-sentence explanation
      action    : optional { label, href } CTA
      priority  : int (lower = shown first)
    """
    tips: list[dict] = []

    # ── System readiness ──────────────────────────────────────────────────────
    if faculty_stats["total"] == 0:
        tips.append({
            "id": "no-faculty", "type": "error", "category": "system", "priority": 1,
            "title": "No faculty loaded",
            "body":  "Upload the faculty specialization matrix before running the scheduler.",
            "action": {"label": "Go to Faculty", "href": "/dashboard/faculty"},
        })

    if course_stats["total"] == 0:
        tips.append({
            "id": "no-courses", "type": "error", "category": "system", "priority": 2,
            "title": "No courses loaded",
            "body":  "Upload the course list so the scheduler can generate a timetable.",
            "action": {"label": "Go to Courses", "href": "/dashboard/courses"},
        })

    if room_stats["total"] == 0:
        tips.append({
            "id": "no-rooms", "type": "error", "category": "system", "priority": 3,
            "title": "No rooms configured",
            "body":  "Add lecture and lab rooms in Settings before running the scheduler.",
            "action": {"label": "Go to Settings", "href": "/dashboard/settings"},
        })

    # ── Faculty gaps ──────────────────────────────────────────────────────────
    if faculty_stats["withoutSpecializations"] > 0 and faculty_stats["total"] > 0:
        n = faculty_stats["withoutSpecializations"]
        tips.append({
            "id": "no-specs", "type": "warning", "category": "faculty", "priority": 10,
            "title": f"{n} faculty member{'s' if n > 1 else ''} without specializations",
            "body":  "Faculty without specializations cannot be auto-assigned. Add their course preferences.",
            "action": {"label": "Manage Faculty", "href": "/dashboard/faculty"},
        })

    if faculty_stats["partTime"] == 0 and faculty_stats["fullTime"] > 0 and course_stats["total"] > 0:
        tips.append({
            "id": "all-fulltime", "type": "info", "category": "faculty", "priority": 30,
            "title": "All faculty are full-time",
            "body":  "Consider adding part-time instructors to handle overflow or specialized courses.",
            "action": {"label": "Add Faculty", "href": "/dashboard/faculty"},
        })

    # ── Room balance ──────────────────────────────────────────────────────────
    if room_stats["lab"] == 0 and course_stats["coursesWithLab"] > 0:
        tips.append({
            "id": "no-lab-rooms", "type": "error", "category": "rooms", "priority": 4,
            "title": "No lab rooms — but lab courses exist",
            "body":  f"{course_stats['coursesWithLab']} courses require a lab room. Add lab rooms in Settings.",
            "action": {"label": "Go to Settings", "href": "/dashboard/settings"},
        })
    elif room_stats["lab"] > 0 and course_stats["coursesWithLab"] > 0:
        # Rough capacity check: each lab room typically handles ~5 sessions/day × 5 days
        approx_lab_cap = room_stats["lab"] * 25
        approx_lab_demand = course_stats["coursesWithLab"] * 2  # ~2 sessions per lab course
        if approx_lab_demand > approx_lab_cap:
            tips.append({
                "id": "lab-capacity", "type": "warning", "category": "rooms", "priority": 15,
                "title": "Lab rooms may be undersupplied",
                "body":  f"{course_stats['coursesWithLab']} lab courses vs {room_stats['lab']} lab rooms. Consider adding more labs.",
                "action": {"label": "Go to Settings", "href": "/dashboard/settings"},
            })

    # ── Course distribution ───────────────────────────────────────────────────
    # Only flag as imbalanced if 1st Sem vs 2nd Sem are very uneven — Midyear
    # is intentionally small so it's excluded from this check entirely.
    sem = course_stats.get("bySemester", {})
    sem1 = sem.get("1st Semester", 0)
    sem2 = sem.get("2nd Semester", 0)
    if sem1 > 0 and sem2 > 0:
        major_sem_max = max(sem1, sem2)
        major_sem_min = min(sem1, sem2)
        if major_sem_min / major_sem_max < 0.5:
            low_sem = "1st Semester" if sem1 < sem2 else "2nd Semester"
            tips.append({
                "id": "sem-imbalance", "type": "info", "category": "courses", "priority": 25,
                "title": f"Uneven course count between semesters",
                "body":  f"'{low_sem}' has significantly fewer courses than the other. Review if this is intentional.",
                "action": {"label": "View Courses", "href": "/dashboard/courses"},
            })

    # ── Schedule health ───────────────────────────────────────────────────────
    if schedule_health["hasLiveSchedule"]:
        if schedule_health["conflictCount"] > 0:
            n = schedule_health["conflictCount"]
            tips.append({
                "id": "conflicts", "type": "error", "category": "schedule", "priority": 5,
                "title": f"{n} scheduling conflict{'s' if n > 1 else ''} detected",
                "body":  "Room or faculty double-bookings exist in the loaded schedule. Review and resolve.",
                "action": {"label": "View Schedule", "href": "/dashboard/schedule"},
            })

        if schedule_health["tbaSessions"] > 0:
            n = schedule_health["tbaSessions"]
            tips.append({
                "id": "tba-sessions", "type": "warning", "category": "schedule", "priority": 8,
                "title": f"{n} unassigned session{'s' if n > 1 else ''} (TBA)",
                "body":  "Some courses have no faculty assigned yet. Manually assign or re-run the scheduler.",
                "action": {"label": "View Schedule", "href": "/dashboard/schedule"},
            })

        if schedule_health["overloadedCount"] > 0:
            n    = schedule_health["overloadedCount"]
            names = ", ".join(schedule_health.get("overloadedNames", [])[:3])
            suffix = "…" if n > 3 else ""
            tips.append({
                "id": "overloaded", "type": "error", "category": "faculty", "priority": 6,
                "title": f"{n} faculty member{'s' if n > 1 else ''} over unit cap",
                "body":  f"{names}{suffix} exceed their maximum teaching load. Reassign sessions.",
                "action": {"label": "Check Workload", "href": "/dashboard/analytics"},
            })

        if schedule_health["nearCapCount"] > 0 and schedule_health["overloadedCount"] == 0:
            n = schedule_health["nearCapCount"]
            tips.append({
                "id": "near-cap", "type": "warning", "category": "faculty", "priority": 20,
                "title": f"{n} faculty member{'s' if n > 1 else ''} approaching unit cap",
                "body":  "These instructors are at ≥85% capacity. Avoid adding more sessions to them.",
                "action": {"label": "Check Workload", "href": "/dashboard/analytics"},
            })

        cov = schedule_health["coveragePct"]
        if cov == 100:
            tips.append({
                "id": "full-coverage", "type": "success", "category": "schedule", "priority": 40,
                "title": "All sessions assigned",
                "body":  "Every course has a faculty member assigned. The schedule is ready.",
                "action": {"label": "View Schedule", "href": "/dashboard/schedule"},
            })
        elif cov >= 90:
            tips.append({
                "id": "high-coverage", "type": "info", "category": "schedule", "priority": 35,
                "title": f"{cov}% of sessions assigned",
                "body":  "Almost there — a few sessions remain unassigned. Check the TBA list.",
                "action": {"label": "View Schedule", "href": "/dashboard/schedule"},
            })
    else:
        # No schedule loaded
        if faculty_stats["total"] > 0 and course_stats["total"] > 0 and room_stats["total"] > 0:
            tips.append({
                "id": "ready-to-run", "type": "success", "category": "system", "priority": 11,
                "title": "System is ready to schedule",
                "body":  "Faculty, courses, and rooms are all configured. Run the scheduler to generate a timetable.",
                "action": {"label": "Run Scheduler", "href": "/dashboard/scheduler"},
            })

    # ── Specialization coverage check ─────────────────────────────────────────
    # Match by courseTitle (stable) with courseCode fallback for legacy entries.
    from collections import defaultdict as _dd
    title_index: dict[str, int] = _dd(int)
    for f in active_faculty:
        for s in (f.get("specializations", []) or []):
            ct = (s.get("courseTitle") or "").strip().lower() if isinstance(s, dict) else ""
            cc = (s.get("courseCode",  "") if isinstance(s, dict) else str(s)).strip().lower()
            key = ct if ct else cc
            if key:
                title_index[key] += 1

    def _spec_count(course) -> int:
        ct = (course.get("title") or "").strip().lower()
        cc = (course.get("courseCode") or "").strip().lower()
        return title_index.get(ct) or title_index.get(cc) or 0

    orphan_courses = [
        c for c in courses[:200]
        if _spec_count(c) == 0
        and not _is_other_dept(c.get("courseCode", ""))
    ]
    if orphan_courses:
        n = len(orphan_courses)
        sample = ", ".join((c.get("title") or c.get("courseCode", "")) for c in orphan_courses[:3])
        suffix = "…" if n > 3 else ""
        tips.append({
            "id": "orphan-courses", "type": "warning", "category": "faculty", "priority": 12,
            "title": f"{n} course{'s' if n > 1 else ''} have no faculty with matching specializations",
            "body":  f"{sample}{suffix} — these will be marked TBA after auto-assignment. You can still assign faculty manually after scheduling.",
            "action": {"label": "Update Specializations", "href": "/dashboard/faculty"},
        })

    # Sort by priority (ascending) and cap at 6 visible suggestions
    tips.sort(key=lambda t: t["priority"])
    return tips[:8]


# ── NEW: Pre-diagnostic feasibility check ─────────────────────────────────────

@router.get("/pre-diagnostic")
def pre_diagnostic(semester: str = None, user=Depends(admin_only)):
    """
    Fast (< 300 ms) pre-scheduling feasibility check.

    Runs purely on in-memory caches — no Firestore calls, no CP-SAT.
    Returns a structured verdict with per-check details and recommendations.

    Accuracy note: catches definite failures (resource shortfalls, impossible
    slot pools) with high confidence. Gray-zone interactions between multiple
    constraints can only be detected by the actual solver.
    """
    from collections import defaultdict
    import math

    courses_all = get_courses()
    faculty_all = get_faculty()
    rooms       = get_rooms()

    # Filter by semester if requested
    if semester:
        courses = [c for c in courses_all if c.get("semester", "1st Semester") == semester]
    else:
        courses = courses_all

    active_faculty = [f for f in faculty_all if not f.get("archived", False)]
    lec_rooms = rooms.get("lecture", []) if isinstance(rooms, dict) else []
    lab_rooms = rooms.get("lab",     []) if isinstance(rooms, dict) else []

    # ── Time grid ─────────────────────────────────────────────────────────────
    # Default: 7:00–21:00, 30-min slots, 6 days — matches scheduler defaults
    n_days          = 6          # Mon–Sat
    slots_per_day   = 28         # (21 - 7) / 0.5
    lunch_slots     = 2          # 11:30–12:30 blocked
    usable_per_day  = slots_per_day - lunch_slots   # 26 effective slots per room per day
    total_lec_slots = usable_per_day * n_days * max(len(lec_rooms), 1)
    total_lab_slots = usable_per_day * n_days * max(len(lab_rooms), 1)

    # ── Compute total slot-hours demanded ─────────────────────────────────────
    # Lecture session: lec_u hours → lec_u * 2 slots (30-min granularity)
    # Lab session: lab_u * 6 slots (lab unit = 3 hrs = 6 × 30-min slots) — but scheduler
    #   uses lab_u * 3 hrs / 0.5 = lab_u * 6 slots when lab_u=1 gives count=2,dur=3
    # Blocks are multiplied per-course

    OTHER_PREFIXES = ("GEC", "MAT", "MATH", "NSTP", "PATHFIT", "PE")

    total_lec_demand = 0     # in 30-min slot-units
    total_lab_demand = 0
    nstp_sessions    = []    # (blocks, slots_needed_per_session)
    gec_sessions     = []
    pe_sessions      = []
    major_sessions: dict[str, list] = defaultdict(list)   # section_key → sessions
    courses_no_lab_room  = []
    courses_no_lec_room  = []
    per_section_load: dict[str, int] = defaultdict(int)  # (prog, yr, blk) → total slots

    for c in courses:
        code = (c.get("courseCode") or "").upper()
        try:
            lec_u = float(c.get("unitsLecture", 0) or 0)
            lab_u = float(c.get("unitsLab",     0) or 0)
        except (ValueError, TypeError):
            lec_u, lab_u = 0.0, 0.0

        blocks    = int(c.get("blocks", 1) or 1)
        yr        = int(c.get("yearLevel", 1) or 1)
        prog      = c.get("program", "Unknown")
        is_nstp   = "NSTP" in code
        is_gec    = code.startswith("GEC") or code.startswith("MAT")
        is_pe     = "PE" in code or "PATHFIT" in code

        # Lecture slot demand
        if lec_u > 0:
            total_lec_slots_course = int(lec_u * 2)  # one session worth
            # Scheduler splits > 3 slots into 2 sessions
            n_lec_sessions = 2 if total_lec_slots_course > 3 and not is_nstp else 1
            dur = total_lec_slots_course // n_lec_sessions if n_lec_sessions > 1 else total_lec_slots_course
            demand_per_block = dur * n_lec_sessions

            # GEC and NSTP blocks are merged in pairs by the scheduler — two blocks
            # share a single room slot, so actual room demand is halved.
            # PE and majors are placed independently per block (no merging).
            if is_gec or is_nstp:
                # ceil so an odd block count still gets one unmerged slot
                effective_blocks = math.ceil(blocks / 2)
            else:
                effective_blocks = blocks

            total_lec_demand += demand_per_block * effective_blocks

            if lab_u == 0 and not len(lec_rooms):
                courses_no_lec_room.append(code)

            for b in range(blocks):
                blk = chr(ord('A') + b)
                sk = f"{prog}_{yr}_{blk}"
                if is_nstp:
                    nstp_sessions.append({"blocks": 1, "dur": dur, "n": n_lec_sessions, "code": code})
                elif is_gec:
                    gec_sessions.append({"blocks": 1, "dur": dur, "n": n_lec_sessions, "code": code})
                elif is_pe:
                    # PE is placed at day edges after all other courses — its placement
                    # depends on schedule density at solve time, not a fixed slot pool.
                    # Don't add to per_section_load (wrong constraint model for PE).
                    pe_sessions.append({"blocks": 1, "dur": dur, "n": n_lec_sessions, "code": code})
                else:
                    per_section_load[sk] += demand_per_block
                    major_sessions[sk].append({"dur": dur, "n": n_lec_sessions, "type": "lec"})

        # Lab slot demand
        if lab_u > 0:
            if lab_u == 1:
                n_lab_sessions, lab_dur = 2, 3
            else:
                total_lab = int(lab_u * 6)
                n_lab_sessions, lab_dur = 2, total_lab // 2
            demand_per_block = lab_dur * n_lab_sessions
            total_lab_demand += demand_per_block * blocks

            if not len(lab_rooms):
                courses_no_lab_room.append(code)

            for b in range(blocks):
                blk = chr(ord('A') + b)
                sk = f"{prog}_{yr}_{blk}"
                per_section_load[sk] += demand_per_block
                major_sessions[sk].append({"dur": lab_dur, "n": n_lab_sessions, "type": "lab"})

    # ── Build checks ──────────────────────────────────────────────────────────
    checks = []

    # 1. Basic data completeness
    has_courses  = len(courses) > 0
    has_faculty  = len(active_faculty) > 0
    has_lec_room = len(lec_rooms) > 0
    has_lab_room = len(lab_rooms) > 0
    has_lab_courses = any(float(c.get("unitsLab", 0) or 0) > 0 for c in courses)

    checks.append({
        "id":     "data_completeness",
        "label":  "Data completeness",
        "status": "pass" if (has_courses and has_faculty and has_lec_room) else "fail",
        "detail": (
            "Faculty, courses, and lecture rooms are all loaded."
            if has_courses and has_faculty and has_lec_room
            else f"Missing: {'courses ' if not has_courses else ''}{'faculty ' if not has_faculty else ''}{'lecture rooms' if not has_lec_room else ''}. Scheduler cannot run without these."
        ),
        "metric": None,
    })

    if has_lab_courses and not has_lab_room:
        checks.append({
            "id":     "lab_rooms_missing",
            "label":  "Lab rooms",
            "status": "fail",
            "detail": f"{sum(1 for c in courses if float(c.get('unitsLab',0) or 0) > 0)} lab courses exist but no lab rooms are configured. These courses cannot be placed.",
            "metric": None,
        })
    elif has_lab_courses:
        checks.append({
            "id":     "lab_rooms_present",
            "label":  "Lab rooms",
            "status": "pass",
            "detail": f"{len(lab_rooms)} lab room(s) available for {sum(1 for c in courses if float(c.get('unitsLab',0) or 0) > 0)} lab course(s).",
            "metric": None,
        })

    # 2. Lecture room capacity
    actual_lec_slots = usable_per_day * n_days * len(lec_rooms)
    lec_util = round(total_lec_demand / actual_lec_slots * 100, 1) if actual_lec_slots > 0 else 999
    checks.append({
        "id":     "lecture_capacity",
        "label":  "Lecture room capacity",
        "status": "fail" if lec_util > 95 else "warn" if lec_util > 80 else "pass",
        "detail": (
            f"{total_lec_demand} lecture slot-units needed across {len(lec_rooms)} room(s) "
            f"({actual_lec_slots} available) — {lec_util}% utilization."
            + (" Rooms are critically overbooked." if lec_util > 95
               else " Getting tight — consider adding a lecture room." if lec_util > 80
               else "")
        ),
        "metric": {"value": lec_util, "label": "Lecture utilization", "unit": "%"},
    })

    # 3. Lab room capacity
    if has_lab_courses and len(lab_rooms) > 0:
        actual_lab_slots = usable_per_day * n_days * len(lab_rooms)
        lab_util = round(total_lab_demand / actual_lab_slots * 100, 1) if actual_lab_slots > 0 else 999
        checks.append({
            "id":     "lab_capacity",
            "label":  "Lab room capacity",
            "status": "fail" if lab_util > 95 else "warn" if lab_util > 80 else "pass",
            "detail": (
                f"{total_lab_demand} lab slot-units needed across {len(lab_rooms)} room(s) "
                f"({actual_lab_slots} available) — {lab_util}% utilization."
                + (" Lab rooms are critically overbooked." if lab_util > 95
                   else " Lab capacity is tight." if lab_util > 80
                   else "")
            ),
            "metric": {"value": lab_util, "label": "Lab utilization", "unit": "%"},
        })

    # 4. NSTP slot pool check
    # NSTP is restricted to Fri/Sat only — 2 days, 3 valid fixed offsets each.
    # Multiple sections can run in parallel across rooms, so total capacity
    # = time positions × lecture rooms. Blocks are merged in pairs by the scheduler.
    nstp_time_positions = 2 * 3  # days × fixed offsets
    nstp_available_slots = nstp_time_positions * max(len(lec_rooms), 1)
    nstp_total_blocks = sum(
        int(c.get("blocks", 1) or 1)
        for c in courses if "NSTP" in (c.get("courseCode") or "").upper()
    )
    # Each pair of blocks shares one slot → round up for odd block counts
    nstp_sessions_needed = math.ceil(nstp_total_blocks / 2) if nstp_total_blocks > 0 else 0
    if nstp_total_blocks > 0:
        nstp_ok = nstp_sessions_needed <= nstp_available_slots
        checks.append({
            "id":     "nstp_slots",
            "label":  "NSTP slot pool",
            "status": "pass" if nstp_ok else ("warn" if nstp_sessions_needed <= nstp_available_slots * 1.5 else "fail"),
            "detail": (
                f"NSTP restricted to Fri/Sat, 3 fixed time slots × {len(lec_rooms)} lecture room(s) "
                f"= {nstp_available_slots} effective positions. "
                f"{nstp_total_blocks} block(s) → {nstp_sessions_needed} merged slot(s) needed "
                f"(blocks are paired, so demand is halved)."
                + (" Fits comfortably." if nstp_ok
                   else " Very tight — some NSTP sections may fail to place.")
            ),
            "metric": {"value": nstp_sessions_needed, "label": "merged slots needed", "unit": f"/ {nstp_available_slots}"},
        })

    # 5. GEC/MAT slot pool check
    # GEC/MAT restricted to Mon–Thu, 8 fixed start offsets per day.
    # Multiple sections CAN occupy the same time offset in different rooms simultaneously,
    # so total capacity = time_positions × lecture_rooms.
    # The scheduler also merges blocks in pairs AND enforces Mon↔Tue / Wed↔Thu pairing
    # per course (partially modeled — conservative estimate).
    gec_available = 4 * 8 * max(len(lec_rooms), 1)  # time positions × parallel room capacity
    gec_raw_blocks = sum(
        int(c.get("blocks", 1) or 1)
        for c in courses
        if (c.get("courseCode") or "").upper().startswith(("GEC", "MAT"))
    )
    # Each pair of blocks shares one slot position (merged in scheduler)
    gec_sessions_needed = math.ceil(gec_raw_blocks / 2) if gec_raw_blocks > 0 else 0
    if gec_sessions_needed > 0:
        gec_pct = round(gec_sessions_needed / gec_available * 100, 1)
        checks.append({
            "id":     "gec_slots",
            "label":  "GEC / MAT slot pool",
            "status": "fail" if gec_pct > 90 else "warn" if gec_pct > 70 else "pass",
            "detail": (
                f"GEC/MAT restricted to Mon–Thu, 8 fixed time patterns × {len(lec_rooms)} lecture room(s) "
                f"= {gec_available} effective positions. "
                f"{gec_raw_blocks} block(s) → {gec_sessions_needed} merged slot(s) needed "
                f"({gec_pct}% of pool). Note: the solver also enforces Mon↔Tue / Wed↔Thu "
                f"pairing per course, which may further reduce effective options."
                + (" Pool nearly exhausted — high risk of failure." if gec_pct > 90
                   else " Pool is getting tight." if gec_pct > 70
                   else " Pool has sufficient headroom.")
            ),
            "metric": {"value": gec_pct, "label": "GEC/MAT pool usage", "unit": "%"},
        })

    # 5b. PE / PATHFIT informational note
    # PE is placed LAST (Phase 7) at the edges of existing sessions on each day.
    # Its feasibility depends entirely on schedule density at solve time — there is
    # no fixed slot pool to check against. We report the count as an informational note.
    pe_total_blocks = sum(
        int(c.get("blocks", 1) or 1)
        for c in courses
        if "PE" in (c.get("courseCode") or "").upper() or "PATHFIT" in (c.get("courseCode") or "").upper()
    )
    if pe_total_blocks > 0:
        checks.append({
            "id":     "pe_placement",
            "label":  "PE / PATHFIT placement",
            "status": "pass",
            "detail": (
                f"{pe_total_blocks} PE/PATHFIT block(s) found. "
                "These are scheduled last, at the edges of existing sessions on each day. "
                "Feasibility depends on how much free edge-time remains after all other courses are placed — "
                "this cannot be accurately predicted before solving."
            ),
            "metric": None,
        })

    # 6. Per-section daily load check
    # Each section has MAX_PHYSICAL_SESSIONS_PER_DAY = 2 physical sessions/day
    # Total physical sessions per section ≤ 2 × n_days
    max_sessions_per_section = 2 * n_days
    overloaded_sections = []
    for sk, total_slots_sk in per_section_load.items():
        # Estimate number of sessions: total_slots / avg_duration (3 slots ≈ 1.5 hr)
        est_sessions = math.ceil(total_slots_sk / 3)
        if est_sessions > max_sessions_per_section:
            overloaded_sections.append((sk, est_sessions, max_sessions_per_section))

    if overloaded_sections:
        sample = ", ".join(s[0] for s in overloaded_sections[:3])
        checks.append({
            "id":     "section_overload",
            "label":  "Section daily limits",
            "status": "warn",
            "detail": (
                f"{len(overloaded_sections)} section(s) may exceed the 2-sessions-per-day limit "
                f"({sample}{'…' if len(overloaded_sections) > 3 else ''}). "
                "The solver will try to spread them but may not always succeed."
            ),
            "metric": None,
        })
    else:
        checks.append({
            "id":     "section_overload",
            "label":  "Section daily limits",
            "status": "pass",
            "detail": "All sections are within the 2 physical sessions per day limit.",
            "metric": None,
        })

    # 7. Faculty specialization coverage — matched by courseTitle (stable key)
    title_spec_index: dict[str, int] = defaultdict(int)
    for f in active_faculty:
        for s in (f.get("specializations") or []):
            ct = (s.get("courseTitle") or "").strip().lower() if isinstance(s, dict) else ""
            cc = (s.get("courseCode",  "") if isinstance(s, dict) else str(s)).strip().lower()
            key = ct if ct else cc
            if key:
                title_spec_index[key] += 1

    def _title_spec_count(c) -> int:
        ct = (c.get("title") or "").strip().lower()
        cc = (c.get("courseCode") or "").strip().lower()
        return title_spec_index.get(ct) or title_spec_index.get(cc) or 0

    major_codes = [
        c for c in courses
        if not any((c.get("courseCode") or "").upper().startswith(p) for p in OTHER_PREFIXES)
    ]
    no_pool   = [c for c in major_codes if _title_spec_count(c) == 0]
    thin_pool = [c for c in major_codes if _title_spec_count(c) == 1]

    if no_pool:
        sample = ", ".join((c.get("title") or c.get("courseCode") or "") for c in no_pool[:4])
        checks.append({
            "id":     "faculty_coverage",
            "label":  "Faculty specialization coverage",
            "status": "warn",
            "detail": (
                f"{len(no_pool)} major course(s) have no faculty with matching specializations "
                f"({sample}{'…' if len(no_pool) > 4 else ''}). "
                "These will be placed as TBA — assign faculty manually after scheduling."
            ),
            "metric": {"value": len(no_pool), "label": "Unmatched courses", "unit": ""},
        })
    elif thin_pool:
        checks.append({
            "id":     "faculty_coverage",
            "label":  "Faculty specialization coverage",
            "status": "warn",
            "detail": (
                f"{len(thin_pool)} course(s) have only 1 eligible faculty member. "
                "If that person is unavailable or overloaded, those sessions become TBA."
            ),
            "metric": {"value": len(thin_pool), "label": "Single-faculty courses", "unit": ""},
        })
    else:
        covered_pct = round(len([c for c in major_codes if _title_spec_count(c) > 0]) / max(len(major_codes), 1) * 100, 1)
        checks.append({
            "id":     "faculty_coverage",
            "label":  "Faculty specialization coverage",
            "status": "pass",
            "detail": f"All major courses have at least 2 eligible faculty. Coverage: {covered_pct}% of {len(major_codes)} courses.",
            "metric": {"value": covered_pct, "label": "Coverage", "unit": "%"},
        })

    # 8. Overall faculty unit capacity
    total_unit_demand = sum(
        (float(c.get("unitsLecture", 0) or 0) + float(c.get("unitsLab", 0) or 0))
        * int(c.get("blocks", 1) or 1)
        for c in courses
        if not any((c.get("courseCode") or "").upper().startswith(p) for p in OTHER_PREFIXES)
    )
    total_faculty_capacity = sum(
        24.0 if f.get("status", "full-time") == "full-time" else 15.0
        for f in active_faculty
    )
    cap_util = round(total_unit_demand / total_faculty_capacity * 100, 1) if total_faculty_capacity > 0 else 999
    checks.append({
        "id":     "faculty_capacity",
        "label":  "Faculty unit capacity",
        "status": "fail" if cap_util > 100 else "warn" if cap_util > 85 else "pass",
        "detail": (
            f"~{round(total_unit_demand)} teaching units needed across {len(active_faculty)} faculty "
            f"(max capacity ~{round(total_faculty_capacity)} units) — {cap_util}% utilization."
            + (" Faculty are at or over theoretical capacity — expect TBA sessions." if cap_util > 100
               else " Close to capacity — scheduling may produce overloads." if cap_util > 85
               else "")
        ),
        "metric": {"value": cap_util, "label": "Faculty load", "unit": "%"},
    })

    # ── Verdict ───────────────────────────────────────────────────────────────
    n_fail = sum(1 for c in checks if c["status"] == "fail")
    n_warn = sum(1 for c in checks if c["status"] == "warn")

    if n_fail >= 2:
        verdict = "infeasible"
        verdict_label = "Likely Infeasible"
        verdict_detail = "Multiple hard constraints cannot be satisfied with the current configuration."
    elif n_fail == 1:
        verdict = "at_risk"
        verdict_label = "At Risk"
        verdict_detail = "One critical constraint is failing. Fix it before scheduling or expect the solver to fail."
    elif n_warn >= 3:
        verdict = "tight"
        verdict_label = "Feasible but Tight"
        verdict_detail = "The schedule is likely solvable but resource utilization is high. Minor changes could cause failures."
    elif n_warn >= 1:
        verdict = "likely_feasible"
        verdict_label = "Likely Feasible"
        verdict_detail = "A few soft constraints are close to their limits, but the solver should find a solution."
    else:
        verdict = "feasible"
        verdict_label = "Feasible"
        verdict_detail = "All checked constraints are within comfortable limits. Good to go."

    # ── Recommendations ───────────────────────────────────────────────────────
    recommendations = _build_diagnostic_recommendations(checks, courses, active_faculty, lec_rooms, lab_rooms, semester)

    return {
        "verdict":          verdict,
        "verdictLabel":     verdict_label,
        "verdictDetail":    verdict_detail,
        "semester":         semester or "All semesters",
        "checks":           checks,
        "recommendations":  recommendations,
        "summary": {
            "totalCourses":     len(courses),
            "majorCourses":     len(major_codes),
            "totalSections":    sum(int(c.get("blocks", 1) or 1) for c in courses),
            "totalFaculty":     len(active_faculty),
            "lectureRooms":     len(lec_rooms),
            "labRooms":         len(lab_rooms),
            "failCount":        n_fail,
            "warnCount":        n_warn,
        },
        "accuracy_note": (
            "This check catches definite resource shortfalls and constraint violations with high accuracy. "
            "It cannot predict interaction effects between multiple constraints or edge cases in the CP-SAT solver. "
            "A 'feasible' verdict does not guarantee a perfect schedule — always review the result after solving."
        ),
    }


def _build_diagnostic_recommendations(checks, courses, faculty, lec_rooms, lab_rooms, semester):
    import math
    recs = []
    check_map = {c["id"]: c for c in checks}

    if check_map.get("data_completeness", {}).get("status") == "fail":
        recs.append({
            "priority": 1, "type": "blocker",
            "title": "Fix missing data before scheduling",
            "body": "The scheduler needs faculty, courses, and at least one lecture room. Add the missing items first.",
        })

    if check_map.get("lab_rooms_missing", {}).get("status") == "fail":
        recs.append({
            "priority": 2, "type": "blocker",
            "title": "Add lab rooms in Settings",
            "body": "Lab courses are configured but no lab rooms exist. Add at least one lab room or remove the lab unit values from those courses.",
        })

    lec_check = check_map.get("lecture_capacity", {})
    if lec_check.get("status") in ("fail", "warn"):
        metric = lec_check.get("metric", {}) or {}
        util = metric.get("value", 0)
        if util > 95:
            recs.append({
                "priority": 3, "type": "blocker",
                "title": f"Add lecture rooms — current utilization is {util}%",
                "body": f"With {len(lec_rooms)} lecture room(s), there is not enough physical space for all sessions. Add at least {max(1, math.ceil(len(lec_rooms) * (util / 100 - 1) + 1))} more room(s).",
            })
        else:
            recs.append({
                "priority": 5, "type": "suggestion",
                "title": "Consider adding a lecture room as buffer",
                "body": f"Lecture rooms are at {util}% utilization. A single additional room would give the solver more flexibility.",
            })

    lab_check = check_map.get("lab_capacity", {})
    if lab_check.get("status") in ("fail", "warn"):
        metric = lab_check.get("metric", {}) or {}
        util = metric.get("value", 0)
        recs.append({
            "priority": 4 if util > 95 else 6, "type": "blocker" if util > 95 else "suggestion",
            "title": f"Lab rooms at {util}% — {'critically ' if util > 95 else ''}overloaded",
            "body": "Add more lab rooms or reduce the number of lab blocks. Lab sessions require contiguous multi-slot windows which are harder to place.",
        })

    if check_map.get("nstp_slots", {}).get("status") in ("fail", "warn"):
        recs.append({
            "priority": 3, "type": "warning",
            "title": "Reduce NSTP sections or allow Saturday scheduling",
            "body": "NSTP is pinned to Fri/Sat with only 3 time-slot positions. With many sections, some will fail to place. Ensure Saturday is enabled in Settings.",
        })

    if check_map.get("gec_slots", {}).get("status") in ("fail", "warn"):
        metric = check_map.get("gec_slots", {}).get("metric", {}) or {}
        pct = metric.get("value", 0)
        recs.append({
            "priority": 4, "type": "warning" if pct <= 90 else "blocker",
            "title": f"GEC/MAT pool at {pct}% — reduce sections or add days",
            "body": "GEC and MAT courses use a restricted set of fixed time patterns on Mon–Thu. Reducing blocks or splitting across semesters would help.",
        })

    if check_map.get("faculty_coverage", {}).get("status") == "warn":
        recs.append({
            "priority": 5, "type": "suggestion",
            "title": "Update faculty specializations before scheduling",
            "body": "Courses with no matching faculty will always be TBA after auto-assignment. Add specializations now to maximize automatic coverage.",
        })

    cap_check = check_map.get("faculty_capacity", {})
    if cap_check.get("status") in ("fail", "warn"):
        metric = cap_check.get("metric", {}) or {}
        util = metric.get("value", 0)
        recs.append({
            "priority": 4, "type": "blocker" if util > 100 else "warning",
            "title": f"Faculty load at {util}% — {'add faculty or reduce blocks' if util > 100 else 'monitor for overloads'}",
            "body": (
                "Total teaching units exceed faculty capacity. Some sessions will be TBA. "
                "Add more faculty, reduce block counts, or split across semesters."
                if util > 100 else
                "Faculty are near maximum capacity. Expect some members to be near or over their unit cap post-scheduling."
            ),
        })

    if not recs:
        recs.append({
            "priority": 99, "type": "success",
            "title": "Configuration looks solid",
            "body": "All pre-scheduling checks passed. Run the scheduler with confidence. Review the result for any solver-level edge cases.",
        })

    recs.sort(key=lambda r: r["priority"])
    return recs
