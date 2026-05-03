from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.globals import schedule_dict
from app.core.firebase import get_faculty
from app.core.unit_balancing import evaluate_workload

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


# ── FIX: Shared active-only faculty helper ────────────────────────────────────
# Both /faculty-preview and /workload operate on the pool of schedulable faculty.
# Archived faculty must never appear as eligible instructors or in workload reports.
# Centralising the filter here means any future endpoint that calls get_faculty()
# for scheduling/analytics purposes only needs one line.

def _get_active_faculty() -> list:
    """Return only non-archived faculty members."""
    return [f for f in get_faculty() if not f.get("archived", False)]


# ── FIX: Exclude externally-managed courses from unassigned/TBA counts ────────
# GEC, MAT, NSTP, PATHFIT, and PE courses are handled by other departments.
# They will always appear as TBA/unassigned in our schedule but that is expected
# and correct — flagging them inflates the unassigned count and misleads admins.

_OTHER_DEPT_PREFIXES = ("GEC", "MAT", "MATH", "NSTP", "PATHFIT", "PE")

def _is_other_dept(course_code: str) -> bool:
    upper = (course_code or "").strip().upper()
    return any(upper.startswith(p) for p in _OTHER_DEPT_PREFIXES)


def _count_conflicts(events: list) -> int:
    """
    Count sessions involved in a room or faculty double-booking.
    A conflict = same room/faculty + same day + overlapping time slot.
    Returns the number of affected session IDs (unique).
    """
    from collections import defaultdict
    # Group by (day, timeslot, resource) — simple exact-slot collision
    room_slots:    dict = defaultdict(list)
    faculty_slots: dict = defaultdict(list)
    conflict_ids:  set  = set()

    for e in events:
        eid  = e.get("id", "")
        day  = e.get("day", "")
        slot = e.get("timeSlot", "") or e.get("time", "")
        room = e.get("room", "")
        fac  = e.get("faculty", "")

        if room and room != "TBA":
            key = (day, slot, room)
            room_slots[key].append(eid)
        if fac and fac != "TBA":
            key = (day, slot, fac)
            faculty_slots[key].append(eid)

    for ids in room_slots.values():
        if len(ids) > 1:
            conflict_ids.update(ids)
    for ids in faculty_slots.values():
        if len(ids) > 1:
            conflict_ids.update(ids)

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

    # ── FIX: GEC/MAT/NSTP/PATHFIT/PE sessions are externally managed —
    # exclude them from all quality metrics so they do not inflate TBA counts
    # or skew scores. They are intentionally unassigned by this department.
    events   = [e for e in all_events if not _is_other_dept(e.get("courseCode", ""))]
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

    # Per-faculty breakdown — reads schedule_dict only, unaffected by archived
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

    # Conflict count operates on ALL events (incl. other-dept) because room
    # double-bookings can involve any session regardless of who manages it.
    total_conflicts = _count_conflicts(all_events)

    return {
        "totalSessions":      total,
        "autoAssigned":       len(auto),
        "tbaSessions":        len(tba),
        "autoAssignPct":      round(len(auto) / total * 100, 1) if total else 0,
        "avgScore":           avg_score,
        "totalConflicts":     total_conflicts,
        "pctInWindow":        round(len(in_win) / len(scored) * 100, 1) if scored else None,
        "pctOnPreferredDays": round(len(on_day) / len(scored) * 100, 1) if scored else None,
        "perFaculty":         per_faculty,
    }


@router.get("/faculty-preview")
def faculty_preview(user=Depends(admin_only)):
    """
    Pre-solve check: eligible faculty count per course.

    ── FIX: uses _get_active_faculty() instead of get_faculty() ──
    Archived faculty were appearing in eligibleFaculty lists and inflating
    poolSize counts, making courses look covered when their only eligible
    instructor had been deactivated.
    """
    from app.core.firebase import get_courses
    courses = get_courses()

    # ── CHANGED: was get_faculty(), now filters out archived ──────────────────
    faculty = _get_active_faculty()

    # Pre-build {courseCode → [faculty names]} map
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
    Faculty workload summary — units assigned vs the *dynamic* cap.

    Cap rules (see app/core/unit_balancing.py):
      Full-Time  1–2 distinct courses  → 24 units
      Full-Time  3–4 distinct courses  → 21 units
      Full-Time  5+ distinct courses   → 18 units
      Part-Time  (any)                 → 15 units

    ── FIX: uses _get_active_faculty() instead of get_faculty() ──
    Archived faculty were appearing in the workload report even after being
    deactivated, cluttering the table and skewing aggregate load metrics.
    """

    # ── CHANGED: was get_faculty(), now filters out archived ──────────────────
    faculty_list = _get_active_faculty()

    # evaluate_workload handles load counting + cap calculation + sort
    rows = evaluate_workload(faculty_list, schedule_dict)

    return {"workload": rows}