from __future__ import annotations
from typing import Any

# ── Cap tables ────────────────────────────────────────────────────────────────

FULLTIME_TIERS: list[tuple[int, float]] = [
    (5, 18.0),
    (3, 21.0),
    (1, 24.0),
]

PARTTIME_CAP: float = 15.0

# REMOVED LAB_UNIT_MULTIPLIER entirely

# ── Public helpers ─────────────────────────────────────────────────────────────

def compute_effective_max_units(
    status: str,
    distinct_course_count: int,
    *,
    parttime_override: bool = False,
) -> float:
    if status.lower() == "part-time":
        return PARTTIME_CAP

    for min_courses, cap in FULLTIME_TIERS:
        if distinct_course_count >= min_courses:
            return cap

    return FULLTIME_TIERS[-1][1]


def compute_session_hours(session: str, raw_units: float) -> float:
    """
    Direct mapping: The units provided by the schedule now equal the exact teaching hours.
    No multipliers are applied.
    """
    return float(raw_units)


def build_faculty_load_map(schedule_dict: dict[str, Any]) -> dict[str, dict]:
    load: dict[str, dict] = {}

    for event_key, event in schedule_dict.items():
        name = event.get("faculty", "TBA")
        if name == "TBA":
            continue

        entry = load.setdefault(name, {
            "assigned_units":   0.0,
            "distinct_courses": set(),
        })

        code = event.get("courseCode", "")
        if code:
            entry["distinct_courses"].add(code)

        session   = event.get("session", "")
        
        # This will now correctly pull the hours we injected in scheduler.py
        raw_units = event.get("units", 0)

        hours = compute_session_hours(session, float(raw_units))
        entry["assigned_units"] += hours

    for entry in load.values():
        entry["course_count"] = len(entry["distinct_courses"])

    return load

def evaluate_workload(
    faculty_list: list[dict],
    schedule_dict: dict[str, Any],
) -> list[dict]:
    load_map = build_faculty_load_map(schedule_dict)

    rows: list[dict] = []
    for f in faculty_list:
        name   = f.get("name", "")
        status = f.get("status", "full-time")

        load         = load_map.get(name, {"assigned_units": 0.0, "course_count": 0})
        assigned     = load["assigned_units"]
        course_count = load["course_count"]

        effective_max = compute_effective_max_units(status, course_count)
        overloaded    = assigned > effective_max

        rows.append({
            "name":              name,
            "status":            status,
            "assigned":          assigned,
            "distinct_courses":  course_count,
            "effective_max":     effective_max,
            "max_units":         effective_max,
            "overloaded":        overloaded,
            "parttime_exceeded": status.lower() == "part-time" and overloaded,
            "tier_label":        _tier_label(status, course_count),
        })

    rows.sort(key=lambda r: (-int(r["overloaded"]), -r["assigned"]))
    return rows


# ── Internal ──────────────────────────────────────────────────────────────────

def _tier_label(status: str, course_count: int) -> str:
    if status.lower() == "part-time":
        return "Part-Time (max 15 units)"
    if course_count >= 5:
        return "Full-Time · 5+ courses (max 18 units)"
    if course_count >= 3:
        return "Full-Time · 3–4 courses (max 21 units)"
    if course_count >= 1:
        return "Full-Time · 1–2 courses (max 24 units)"
    return "Full-Time · no assignments yet (max 24 units)"