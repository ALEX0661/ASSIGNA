"""
app/core/departments.py
────────────────────────────────────────────────────────────────────────────────
Single source of truth for department scoping.

• The auto faculty assigner only considers faculty of its own department.
• A blank / missing `Department` counts as the home department (legacy records
  and Excel imports never write the field).
• Keep MINOR_PREFIXES in sync with src/utils/departments.js.
"""
from __future__ import annotations

import re

DEFAULT_DEPARTMENT = "CCS"

# Identical to the prefixes that were hardcoded in FacultyAssigner._is_eligible
MINOR_PREFIXES = ("GEC", "MAT", "PE", "NSTP", "GE")


def norm_dept(value) -> str:
    """Trim, collapse whitespace, upper-case. None/blank -> ''."""
    return re.sub(r"\s+", " ", str(value or "")).strip().upper()


def effective_dept(value, default: str = DEFAULT_DEPARTMENT) -> str:
    """Normalised department with blank resolved to the home department."""
    return norm_dept(value) or norm_dept(default)


def in_department(faculty: dict, department: str = DEFAULT_DEPARTMENT) -> bool:
    """True if the faculty belongs to `department` (blank Department = home)."""
    dept = norm_dept(faculty.get("Department"))
    return not dept or dept == norm_dept(department)


def is_minor_course(course_code: str) -> bool:
    return str(course_code or "").upper().startswith(MINOR_PREFIXES)
