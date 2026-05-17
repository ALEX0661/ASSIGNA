from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.globals import schedule_dict
from app.core.firebase import get_faculty
from app.core.unit_balancing import evaluate_workload

router = APIRouter()


# ── Shared helpers ────────────────────────────────────────────────────────────

def _extract_course_codes(specializations) -> set[str]:
    """
    Normalise the specializations field to a set of course code strings.

    Stored formats encountered in the wild:
      • List of dicts:   [{"courseCode": "CS101", "rating": 3}, ...]
      • List of strings: ["CS101", "CS102", ...]
      • Comma-separated string: "CS101, CS102"
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
    """Pre-solve check: eligible faculty count per course."""
    from app.core.firebase import get_courses
    courses = get_courses()
    faculty = _get_active_faculty()

    course_pool: dict[str, list[str]] = {}
    for f in faculty:
        f_name = f.get("name", "Unknown")
        codes  = _extract_course_codes(f.get("specializations", []))
        for code in codes:
            course_pool.setdefault(code, []).append(f_name)

    result = []
    for course in courses:
        code = course.get("courseCode", "")
        pool = course_pool.get(code, [])
        result.append({
            "courseCode":      code,
            "title":           course.get("title", ""),
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