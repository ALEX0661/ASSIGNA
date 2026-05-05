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


def _parse_time(raw: str):
    """
    Convert a time string to minutes since midnight.
    Handles:  "7:00", "7:00 AM", "19:00", "7:30 PM"
    Returns None if the string cannot be parsed.
    """
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
    """
    Convert a time-range string to (start_min, end_min).
    Handles:  "7:00-8:30", "7:00 AM - 10:00 AM", "7:00AM-10:00PM"
    Returns None if the slot cannot be parsed as a time range.
    """
    import re
    if not slot:
        return None
    # Split on a dash that is surrounded by optional whitespace,
    # but only when preceded by a digit or AM/PM (avoids splitting on negative).
    parts = re.split(r'(?<=[\dMmPpAa])\s*[-–]\s*(?=\d)', slot.strip(), maxsplit=1)
    if len(parts) != 2:
        return None
    start = _parse_time(parts[0])
    end   = _parse_time(parts[1])
    if start is None or end is None:
        return None
    # Guard: end should be after start (handles overnight edge case)
    if end <= start:
        end += 24 * 60
    return (start, end)


def _slots_overlap(a, b) -> bool:
    """True if two (start, end) pairs overlap (exclusive endpoint)."""
    if a is None or b is None:
        return False
    return a[0] < b[1] and b[0] < a[1]


def _are_merge_partners(ea: dict, eb: dict) -> bool:
    """
    Mirror of the frontend areMergePartners() in svHelpers.js.
    Merge partners share room+time by design and must never be flagged as conflicts.
    Primary rule: same courseCode+program+year+room+day+period, different block.
    Legacy fallback: schedule_ids share numeric base with -Letter suffix (e.g. "123-A"/"123-B").
    """
    if not ea or not eb:
        return False
    # Positional rule
    if (ea.get("courseCode") and ea.get("courseCode") == eb.get("courseCode") and
            ea.get("program") and ea.get("program") == eb.get("program") and
            str(ea.get("year", "")) == str(eb.get("year", "")) and
            ea.get("block") != eb.get("block") and
            ea.get("room") and ea.get("room") != "TBA" and ea.get("room") == eb.get("room") and
            ea.get("day") and ea.get("day") == eb.get("day") and
            ea.get("period") and ea.get("period") == eb.get("period")):
        return True
    # Legacy suffix rule
    import re as _re
    def _base(s): return _re.sub(r'-[A-Z]$', '', str(s or ''))
    def _has(s):  return bool(_re.search(r'-[A-Z]$', str(s or '')))
    sa, sb = str(ea.get("schedule_id") or ""), str(eb.get("schedule_id") or "")
    if _has(sa) and _has(sb) and _base(sa) == _base(sb):
        return True
    return False


def _count_conflicts(events: list) -> int:
    """
    Count sessions involved in a room or faculty double-booking.
    Skips merge partners (two blocks sharing room+time by design).
    Uses real time-range overlap on 'period' field ("10:00 AM - 11:30 AM").
    Falls back to exact-string match for opaque slot indices.
    Returns the count of unique session IDs involved.
    """
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

    # ── FIX: GEC/MAT/NSTP/PATHFIT/PE sessions are externally managed —
    # exclude them from all quality metrics so they do not inflate TBA counts
    # or skew scores. They are intentionally unassigned by this department.
    # All sessions are counted in totalSessions regardless of dept
    total    = len(all_events)
    # Quality metrics (scores, TBA) still exclude externally-managed courses
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
        "majorSessions":      len(events),   # excludes GEC/MAT/NSTP/PE — used for autoAssignPct
        "autoAssigned":       len(auto),
        "tbaSessions":        len(tba),
        # Denominator is major subjects only — GEC/MAT/NSTP/PE are externally
        # managed and never go through auto-assignment, so they must not dilute the rate.
        "autoAssignPct":      round(len(auto) / len(events) * 100, 1) if events else 0,
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