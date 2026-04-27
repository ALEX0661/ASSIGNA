from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.globals import schedule_dict
from app.core.firebase import get_faculty

router = APIRouter()


# ── Shared helper ─────────────────────────────────────────────────────────────

def _extract_course_codes(specializations) -> set[str]:
    """
    Normalise the specializations field to a set of course code strings.

    Stored formats encountered in the wild:
      • List of dicts:   [{"courseCode": "CS101", "rating": 3}, ...]   ← uploaded via Excel matrix
      • List of strings: ["CS101", "CS102", ...]                       ← legacy / manual entry
      • Comma-separated string: "CS101, CS102"                         ← very old records
    """
    codes: set[str] = set()

    if isinstance(specializations, str):
        # "CS101, CS102" → {"CS101", "CS102"}
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
            "pctInWindow":        None,
            "pctOnPreferredDays": None,
            "perFaculty":         [],
        }

    events   = list(schedule_dict.values())
    total    = len(events)
    auto     = [e for e in events if e.get("facultyAutoAssigned")]
    tba      = [e for e in events if e.get("faculty") == "TBA"]
    scored   = [e for e in events if e.get("assignmentScore") is not None]
    in_win   = [e for e in scored  if e.get("assignmentScore", 0) >= 0.6]
    on_day   = [e for e in scored  if e.get("assignmentScore", 0) >= 0.7]

    avg_score = (
        round(sum(e["assignmentScore"] for e in scored) / len(scored), 2)
        if scored else None
    )

    # Per-faculty breakdown
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

    return {
        "totalSessions":      total,
        "autoAssigned":       len(auto),
        "tbaSessions":        len(tba),
        "autoAssignPct":      round(len(auto) / total * 100, 1) if total else 0,
        "avgScore":           avg_score,
        "pctInWindow":        round(len(in_win) / len(scored) * 100, 1) if scored else None,
        "pctOnPreferredDays": round(len(on_day) / len(scored) * 100, 1) if scored else None,
        "perFaculty":         per_faculty,
    }


@router.get("/faculty-preview")
def faculty_preview(user=Depends(admin_only)):
    """
    Pre-solve check: eligible faculty count per course.

    Previously broken because the check used `code in specs` where specs is a
    list of dicts {courseCode, rating} — a string is never `in` a list of dicts.
    Now normalised via _extract_course_codes().
    """
    from app.core.firebase import get_courses
    courses = get_courses()
    faculty = get_faculty()

    # Pre-build {courseCode → [faculty names]} map for O(courses) instead of O(courses × faculty)
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
    """Faculty workload summary — sessions assigned per faculty vs their max units."""
    faculty_list = get_faculty()

    # Count sessions per faculty name from the live schedule
    fac_sessions: dict[str, int] = {}
    for e in schedule_dict.values():
        name = e.get("faculty", "TBA")
        if name == "TBA":
            continue
        fac_sessions[name] = fac_sessions.get(name, 0) + 1

    result = []
    for f in faculty_list:
        name      = f.get("name", "")
        max_units = f.get("max_units", 21)
        assigned  = fac_sessions.get(name, 0)
        result.append({
            "name":       name,
            "assigned":   assigned,
            "max_units":  max_units,
            "overloaded": assigned > max_units,
        })

    # Sort: overloaded first, then by load descending
    result.sort(key=lambda r: (-int(r["overloaded"]), -r["assigned"]))

    return {"workload": result}