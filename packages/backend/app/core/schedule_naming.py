"""Single place that decides what a saved schedule is called.

Convention: "A.Y. <year>, <semester> (<who>)"

    Dean         A.Y. 2026-2027, 1st Semester (Dean)
    Coordinators A.Y. 2026-2027, 1st Semester (Coordinators)

If the name is already taken it becomes "(Dean v2)", "(Dean v3)", and so on.
An optional label goes inside the same brackets:
"A.Y. 2026-2027, 1st Semester (Dean, Real Data Simulation)".
Slashes and brackets are stripped from the year, semester and label, so the
result is always a valid Firestore document id and can always be parsed back
apart when a version number has to be added.
"""

import re

SOURCE_TAGS = {
    "admin": "Dean",
    "queue": "Coordinators",
}


def _clean(value):
    """Slashes would break a Firestore document id; brackets would break the
    "(tag, label)" parsing in unique_schedule_name. Swap both for a hyphen."""
    return re.sub(r"\s+", " ", re.sub(r"[/\\()]", "-", str(value or ""))).strip()


def _term(academic_year, semester):
    academic_year, semester = _clean(academic_year), _clean(semester)
    if academic_year and semester:
        return f"A.Y. {academic_year}, {semester}".strip()
    return " ".join(p for p in (semester, academic_year) if p).strip() or "Schedule"


def base_schedule_name(academic_year, semester, source="admin", label=None):
    """Returns (term, tag) joined later so version numbers can go in the brackets."""
    tag = SOURCE_TAGS.get(source, SOURCE_TAGS["admin"])
    label = _clean(label)
    inner = f"{tag}, {label}" if label else tag
    return f"{_term(academic_year, semester)} ({inner})"


def unique_schedule_name(base, is_taken):
    """base, then the same name with 'v2', 'v3', ... inside the brackets."""
    if not is_taken(base):
        return base
    head, opener, inner = base.rpartition(" (")
    if not opener or not base.endswith(")"):
        # Not in the "term (tag)" shape (shouldn't happen): plain suffix instead.
        n = 2
        while is_taken(f"{base} v{n}"):
            n += 1
        return f"{base} v{n}"
    inner = inner[:-1]
    tag, sep, label = inner.partition(", ")
    n = 2
    while True:
        cand = f"{head} ({tag} v{n}{sep}{label})"
        if not is_taken(cand):
            return cand
        n += 1


def is_placeholder_name(name):
    return (name or "").strip().lower() in ("", "unnamed", "untitled", "new schedule")
