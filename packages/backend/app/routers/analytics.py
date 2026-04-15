from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.globals import schedule_dict
from app.core.firebase import get_faculty

router = APIRouter()


@router.get("/assignment-quality")
def assignment_quality(user=Depends(admin_only)):
    """Post-solve analytics: auto-assign rate, avg score, preference compliance."""
    if not schedule_dict:
        return {
            "totalSessions": 0,
            "autoAssigned": 0,
            "tbaSessions": 0,
            "autoAssignPct": 0,
            "avgScore": None,
            "pctInWindow": None,
            "pctOnPreferredDays": None,
            "perFaculty": [],
        }

    total       = len(schedule_dict)
    auto        = [e for e in schedule_dict if e.get("facultyAutoAssigned")]
    tba         = [e for e in schedule_dict if e.get("faculty") == "TBA"]
    scored      = [e for e in schedule_dict if e.get("assignmentScore") is not None]
    in_window   = [e for e in scored if e.get("assignmentScore", 0) >= 0.6]
    on_pref_day = [e for e in scored if e.get("assignmentScore", 0) >= 0.7]

    avg_score = (
        round(sum(e["assignmentScore"] for e in scored) / len(scored), 2)
        if scored else None
    )

    # Per-faculty breakdown
    fac_map = {}
    for e in schedule_dict:
        name = e.get("faculty", "TBA")
        if name == "TBA":
            continue
        if name not in fac_map:
            fac_map[name] = {"sessions": 0, "scores": []}
        fac_map[name]["sessions"] += 1
        sc = e.get("assignmentScore")
        if sc is not None:
            fac_map[name]["scores"].append(sc)

    per_faculty = []
    for name, info in fac_map.items():
        avg = round(sum(info["scores"]) / len(info["scores"]), 2) if info["scores"] else None
        per_faculty.append({
            "name": name,
            "sessions": info["sessions"],
            "avgScore": avg,
        })

    return {
        "totalSessions":     total,
        "autoAssigned":      len(auto),
        "tbaSessions":       len(tba),
        "autoAssignPct":     round(len(auto) / total * 100, 1) if total else 0,
        "avgScore":          avg_score,
        "pctInWindow":       round(len(in_window)   / len(scored) * 100, 1) if scored else None,
        "pctOnPreferredDays":round(len(on_pref_day) / len(scored) * 100, 1) if scored else None,
        "perFaculty":        per_faculty,
    }


@router.get("/faculty-preview")
def faculty_preview(user=Depends(admin_only)):
    """Pre-solve check: show eligible faculty count per course."""
    from app.core.firebase import get_courses
    courses = get_courses()
    faculty = get_faculty()

    result = []
    for course in courses:
        code = course.get("courseCode", "")
        pool = []
        for f in faculty:
            specs = f.get("specializations", [])
            if isinstance(specs, str):
                specs = [s.strip() for s in specs.split(",")]
            if code in specs:
                pool.append(f.get("name", "Unknown"))
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
    """Faculty workload summary for the bar chart."""
    faculty_list = get_faculty()
    fac_units    = {}
    for e in schedule_dict:
        name = e.get("faculty", "TBA")
        if name == "TBA":
            continue
        fac_units[name] = fac_units.get(name, 0) + 1

    result = []
    for f in faculty_list:
        name     = f.get("name", "")
        assigned = fac_units.get(name, 0)
        result.append({
            "name":      name,
            "assigned":  assigned,
            "max_units": f.get("max_units", 21),
            "overloaded": assigned > f.get("max_units", 21),
        })

    return {"workload": result}
