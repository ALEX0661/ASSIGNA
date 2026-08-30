from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from app.core.auth import admin_only, any_authenticated  # admin_only kept for any route that stays admin-exclusive
from app.core.firebase import db, refresh_courses_cache
from app.models.course import Course, CourseUpdate
from google.cloud import firestore as fs
import pandas as pd
import io
import logging
import base64

logger = logging.getLogger("courses")
router = APIRouter()

# ─── Column aliases (case-insensitive matching) ───────────────────────────────

COLUMN_ALIASES = {
    "courseCode":   ["courseCode", "course_code", "Course Code", "CourseCode", "Code", "code"],
    "title":        ["title", "Title", "course_title", "Course Title", "courseName", "Name"],
    "program":      ["program", "Program", "dept", "Department", "Dept"],
    "yearLevel":    ["yearLevel", "year_level", "Year Level", "Year", "year", "YearLevel"],
    "blocks":       ["blocks", "Blocks", "sections", "Sections", "block"],
    "unitsLecture": ["unitsLecture", "Units Lecture", "Lecture Units", "lec", "Lec",
                     "lecture_units", "LecUnits", "units", "Units"],
    "unitsLab":     ["unitsLab", "Units Lab", "Lab Units", "lab", "Lab",
                     "lab_units", "LabUnits"],
    "semester":     ["semester", "Semester", "Sem", "sem", "Term", "term"],
}

# ─── Template enforcement ─────────────────────────────────────────────────────

# Only files using the official CCS Course List template are accepted.
# The template has exactly these three sheets (any subset is also valid).
TEMPLATE_SHEETS = ["First Semester", "Second Semester", "Midyear"]
TEMPLATE_SHEETS_SET = set(TEMPLATE_SHEETS)

def _find_col(df: pd.DataFrame, candidates: list):
    """Case-insensitive column lookup."""
    lower_map = {c.lower(): c for c in df.columns}
    for candidate in candidates:
        if candidate in df.columns:
            return candidate
        if candidate.lower() in lower_map:
            return lower_map[candidate.lower()]
    return None

def _safe_int(value, default=0) -> int:
    try:
        if pd.isna(value):
            return default
        return int(float(value))
    except (ValueError, TypeError):
        return default

def _safe_str(value, default="") -> str:
    try:
        if pd.isna(value):
            return default
        return str(value).strip()
    except (TypeError, ValueError):
        return default


# ─── Access control: admins can touch any program, coordinators only theirs ───

def _require_program_access(user: dict, program: str):
    """
    Raise 403 unless the caller is an admin, or is a coordinator whose
    coordinatorProgram claim matches the program being written to.
    Mirrors the ownership check pattern used in coordinator.py.
    """
    print("DEBUG _require_program_access ->", user.get("role"), user.get("email"))
    if user.get("role") == "admin":
        return
    coord_program = user.get("coordinatorProgram")
    if not coord_program:
        raise HTTPException(403, "Not authorized to manage courses.")
    if program != coord_program:
        raise HTTPException(403, f"You can only manage courses for {coord_program}.")

def _detect_template_format(contents: bytes, sheet_name: str) -> bool:
    """
    Return True when the file uses the new 4-row template header layout.
    Detection: peek at row 0 cell 0 — if it matches a known column-header
    alias the file is plain/legacy (headers at row 0).  Otherwise it is the
    new template whose real headers sit at row 2 (0-indexed).
    """
    all_aliases_lower = {
        alias.lower()
        for aliases in COLUMN_ALIASES.values()
        for alias in aliases
    }
    try:
        peek = pd.read_excel(
            io.BytesIO(contents), sheet_name=sheet_name,
            header=None, nrows=1,
        )
        first_cell = str(peek.iloc[0, 0]).strip().lower()
        return first_cell not in all_aliases_lower
    except Exception:
        return False


def _parse_excel(contents: bytes, sheet_name: str) -> list[dict]:
    """
    Parse a sheet accepting both formats:

    New template layout (4-row header, auto-detected):
      Row 1 – title banner, Row 2 – instructions,
      Row 3 – column headers, Row 4 – hint row (skipped), Row 5+ – data

    Plain / legacy layout:
      Row 1 – column headers, Row 2+ – data
    """
    is_template = _detect_template_format(contents, sheet_name)
    try:
        if is_template:
            df = pd.read_excel(
                io.BytesIO(contents), sheet_name=sheet_name,
                skiprows=[0, 1, 3], header=0,
            )
        else:
            df = pd.read_excel(io.BytesIO(contents), sheet_name=sheet_name)
    except Exception:
        raise HTTPException(400, f"Could not read the sheet named '{sheet_name}'. Ensure the file is not corrupted.")

    # Resolve column names once
    col = {field: _find_col(df, aliases) for field, aliases in COLUMN_ALIASES.items()}

    missing_required = [f for f in ("courseCode", "title", "program") if not col[f]]
    if missing_required:
        raise HTTPException(
            400,
            f"Required column(s) not found in '{sheet_name}': {', '.join(missing_required)}. "
            f"Found columns: {list(df.columns)}"
        )

    courses = []
    for _, row in df.iterrows():
        courses.append({
            "courseCode":   _safe_str(row[col["courseCode"]] if col["courseCode"] else ""),
            "title":        _safe_str(row[col["title"]]      if col["title"]      else ""),
            "program":      _safe_str(row[col["program"]]    if col["program"]    else ""),
            "yearLevel":    _safe_int(row[col["yearLevel"]]  if col["yearLevel"]  else None, 1),
            "blocks":       _safe_int(row[col["blocks"]]     if col["blocks"]     else None, 0),
            "unitsLecture": _safe_int(row[col["unitsLecture"]] if col["unitsLecture"] else None, 0),
            "unitsLab":     _safe_int(row[col["unitsLab"]]     if col["unitsLab"]     else None, 0),
        })

    # Drop rows with no course code or title (blank rows at end of sheet)
    courses = [c for c in courses if c["courseCode"] and c["title"]]
    return courses


def _cascade_course_update(old_code: str, new_code: str, new_title: str = None):
    faculty_docs = db.collection("faculty").stream()
    batch = db.batch()
    batch_count = 0
    for doc in faculty_docs:
        data = doc.to_dict()
        specs = data.get("specializations", [])
        changed = False
        for i, spec in enumerate(specs):
            if isinstance(spec, dict):
                if spec.get("courseCode") == old_code:
                    if new_code:
                        spec["courseCode"] = new_code
                    if new_title:
                        spec["courseTitle"] = new_title
                        spec["title"] = new_title
                    changed = True
            elif isinstance(spec, str):
                if spec == old_code and new_code:
                    specs[i] = new_code
                    changed = True
        if changed:
            batch.update(doc.reference, {"specializations": specs})
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
    if batch_count > 0:
        batch.commit()

    # Cascade to schedules
    for coll_name in ["final_schedules", "coordinator_schedules", "master_schedules"]:
        sched_docs = db.collection(coll_name).stream()
        batch = db.batch()
        batch_count = 0
        for doc in sched_docs:
            data = doc.to_dict()
            events = data.get("events", [])
            changed = False
            for ev in events:
                if ev.get("courseCode") == old_code:
                    if new_code:
                        ev["courseCode"] = new_code
                        ev["baseCourseCode"] = new_code
                    if new_title:
                        ev["title"] = new_title
                    changed = True
            if changed:
                batch.update(doc.reference, {"events": events})
                batch_count += 1
                if batch_count >= 400:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
        if batch_count > 0:
            batch.commit()

def _cascade_course_deletion(old_code: str):
    faculty_docs = db.collection("faculty").stream()
    batch = db.batch()
    batch_count = 0
    for doc in faculty_docs:
        data = doc.to_dict()
        specs = data.get("specializations", [])
        changed = False
        for i, s in enumerate(specs):
            if isinstance(s, dict):
                if s.get("courseCode") == old_code:
                    s["isUnmatched"] = True
                    changed = True
            elif isinstance(s, str):
                if s == old_code:
                    specs[i] = {"courseCode": s, "isUnmatched": True}
                    changed = True
        if changed:
            batch.update(doc.reference, {"specializations": specs})
            batch_count += 1
            if batch_count >= 400:
                batch.commit()
                batch = db.batch()
                batch_count = 0
    if batch_count > 0:
        batch.commit()

    # Cascade unlinking to schedules
    for coll_name in ["final_schedules", "coordinator_schedules", "master_schedules"]:
        sched_docs = db.collection(coll_name).stream()
        batch = db.batch()
        batch_count = 0
        for doc in sched_docs:
            data = doc.to_dict()
            events = data.get("events", [])
            changed = False
            for ev in events:
                if ev.get("courseCode") == old_code:
                    ev["isUnmatched"] = True
                    changed = True
            if changed:
                batch.update(doc.reference, {"events": events})
                batch_count += 1
                if batch_count >= 400:
                    batch.commit()
                    batch = db.batch()
                    batch_count = 0
        if batch_count > 0:
            batch.commit()

# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
def get_all_courses(semester: str = None, user=Depends(any_authenticated)):
    docs = db.collection("courses").stream()
    courses = [{**d.to_dict(), "id": d.id} for d in docs]
    if semester:
        courses = [c for c in courses if c.get("semester", "1st Semester") == semester]
    return courses


@router.post("/add")
def add_course(data: Course, user=Depends(any_authenticated)):
    _require_program_access(user, data.program)
    existing = db.collection("courses").where("courseCode", "==", data.courseCode).get()
    if existing:
        conflict_title = existing[0].to_dict().get("title", "another course")
        raise HTTPException(400, f"This code is already used by '{conflict_title}'")
        
    doc_id = f"{data.courseCode}_{data.program}"
    ref = db.collection("courses").document(doc_id)
    ref.set(data.dict())
    refresh_courses_cache()
    return {"id": doc_id, "message": "Course added"}


@router.put("/update/{course_code}/{program}")
def update_course(course_code: str, program: str, data: CourseUpdate, user=Depends(any_authenticated)):
    _require_program_access(user, program)

    doc_id  = f"{course_code}_{program}"
    doc_ref = db.collection("courses").document(doc_id)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Course not found")

    # Build the update payload.
    # - Non-None values are written as-is.
    # - Explicit None on a nullable field (e.g. preferredRoom) means "clear it"
    #   → use DELETE_FIELD so Firestore actually removes the field rather than
    #     leaving the old value in place.
    # - Fields that are None only because they weren't sent (all other optional
    #   fields) are skipped entirely via exclude_unset so we don't accidentally
    #   wipe legitimate data.
    NULLABLE_FIELDS = {"preferredRoom"}

    update_data = {}
    for k, v in data.dict(exclude_unset=True).items():
        if v is None and k in NULLABLE_FIELDS:
            update_data[k] = fs.DELETE_FIELD   # clears the field in Firestore
        elif v is not None:
            update_data[k] = v

    # Coordinators may not move a course to a different program via update —
    # only admins can re-assign programs.
    if user.get("role") != "admin" and "program" in update_data and update_data["program"] != program:
        raise HTTPException(403, "You can't change a course's program.")

    if not update_data:
        # Nothing actually changed — return success without hitting Firestore.
        return {"updated": doc_id}

    new_code = update_data.get("courseCode")
    new_title = update_data.get("title")
    code_changed = new_code and new_code != course_code

    if code_changed:
        # Check global uniqueness of new code
        existing = db.collection("courses").where("courseCode", "==", new_code).get()
        if existing:
            conflict_title = existing[0].to_dict().get("title", "another course")
            raise HTTPException(400, f"This code is already used by '{conflict_title}'")
            
        # Create new document and delete old one
        old_data = doc_ref.get().to_dict()
        old_data.update(update_data)
        new_doc_id = f"{new_code}_{program}"
        db.collection("courses").document(new_doc_id).set(old_data, merge=True)
        doc_ref.delete()
        _cascade_course_update(course_code, new_code, new_title)
        final_doc_id = new_doc_id
    else:
        doc_ref.update(update_data)
        if new_title:
            _cascade_course_update(course_code, course_code, new_title)
        final_doc_id = doc_id

    refresh_courses_cache()
    return {"updated": final_doc_id}


@router.delete("/delete/{course_code}/{program}")
def delete_course(course_code: str, program: str, user=Depends(any_authenticated)):
    _require_program_access(user, program)

    doc_id  = f"{course_code}_{program}"
    doc_ref = db.collection("courses").document(doc_id)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Course not found")
    # Soft-delete: archive before removing
    from datetime import datetime
    data = doc_ref.get().to_dict()
    data["archivedAt"] = datetime.utcnow().isoformat()
    db.collection("archived_courses").document(doc_id).set(data)
    doc_ref.delete()
    _cascade_course_deletion(course_code)
    refresh_courses_cache()
    return {"deleted": doc_id, "archived": True}


@router.post("/upload")
async def upload_courses_excel(file: UploadFile = File(...), user=Depends(any_authenticated)):
    """
    Accepts the official CCS Course List template (.xlsx).
    Validates that every sheet in the file belongs to the known template sheets,
    then returns the valid sheet list and a base64-encoded copy of the file.
    """
    is_admin = user.get("role") == "admin"
    if not is_admin and not user.get("coordinatorProgram"):
        raise HTTPException(403, "Not authorized to upload courses.")

    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Please upload an .xlsx or .xls file.")

    contents = await file.read()

    try:
        xl = pd.ExcelFile(io.BytesIO(contents))
        sheets = xl.sheet_names
    except Exception:
        raise HTTPException(400, "Invalid Excel file format or corrupted file.")

    # ── Template enforcement ──────────────────────────────────────────────────
    # Reject any file whose sheets don't match the official CCS Course List
    # template.  Every sheet present must be one of the three template sheets;
    # stray sheets (e.g. from a generic spreadsheet) are not allowed.
    unrecognised = [s for s in sheets if s not in TEMPLATE_SHEETS_SET]
    if unrecognised:
        raise HTTPException(
            400,
            f"Wrong template — unrecognised sheet(s): {', '.join(repr(s) for s in unrecognised)}. "
            "Please download and use the official CCS Course List template "
            f"(expected sheets: {', '.join(TEMPLATE_SHEETS)}).",
        )

    valid_sheets = [s for s in TEMPLATE_SHEETS if s in sheets]
    if not valid_sheets:
        raise HTTPException(
            400,
            "No valid template sheets found. "
            f"Expected at least one of: {', '.join(TEMPLATE_SHEETS)}.",
        )

    return {
        "sheets": valid_sheets,                                   # canonical order
        "fileData": base64.b64encode(contents).decode("utf-8"),
    }


@router.post("/upload/extract")
def extract_selected_sheet(data: dict, user=Depends(any_authenticated)):
    """
    Takes the base64 encoded file and the selected sheet name, 
    then parses the courses from that specific sheet.
    """
    if not (user.get("role") == "admin") and not user.get("coordinatorProgram"):
        raise HTTPException(403, "Not authorized to upload courses.")

    sheet_name = data.get("sheetName")
    file_data  = data.get("fileData")

    if not sheet_name or not file_data:
        raise HTTPException(400, "Missing sheet selection or file data.")

    if sheet_name not in TEMPLATE_SHEETS_SET:
        raise HTTPException(
            400,
            f"'{sheet_name}' is not a valid template sheet. "
            f"Expected one of: {', '.join(TEMPLATE_SHEETS)}.",
        )

    try:
        contents = base64.b64decode(file_data)
        courses = _parse_excel(contents, sheet_name)
    except Exception as exc:
        raise HTTPException(400, f"Failed to extract data: {exc}")

    # Coordinators only ever see their own program's rows, even if the sheet
    # contains other programs — this mirrors the frontend's lockedProgram
    # filter but is enforced here so it can't be bypassed by calling the
    # API directly.
    if not (user.get("role") == "admin"):
        coord_program = user.get("coordinatorProgram")
        courses = [c for c in courses if c.get("program") == coord_program]

    return {"preview": courses, "count": len(courses)}


@router.post("/upload/commit")
def commit_uploaded_courses(data: dict, user=Depends(any_authenticated)):
    """
    Bulk upsert courses from the upload preview.
    Returns per-course success/failure so the frontend can surface partial errors.
    """
    if not (user.get("role") == "admin") and not user.get("coordinatorProgram"):
        raise HTTPException(403, "Not authorized to upload courses.")

    courses = data.get("courses", [])
    if not courses:
        raise HTTPException(400, "No courses provided.")

    is_admin      = user.get("role") == "admin"
    coord_program = user.get("coordinatorProgram")

    saved  = 0
    failed = []

    batch = db.batch()
    for c in courses:
        code    = c.get("courseCode", "").strip()
        program = c.get("program",    "").strip()

        if not code or not program:
            failed.append({"course": c, "reason": "Missing courseCode or program"})
            continue

        # A coordinator can only ever commit rows for their own program —
        # enforced here regardless of what the client sent.
        if not is_admin and program != coord_program:
            failed.append({"course": c, "reason": f"Not authorized for program {program}"})
            continue

        doc_id = f"{code}_{program}"
        ref    = db.collection("courses").document(doc_id)
        batch.set(ref, {
            "courseCode":   code,
            "title":        c.get("title",        ""),
            "program":      program,
            "yearLevel":    _safe_int(c.get("yearLevel"),    1),
            "blocks":       _safe_int(c.get("blocks"),       1),
            "unitsLecture": _safe_int(c.get("unitsLecture"), 0),
            "unitsLab":     _safe_int(c.get("unitsLab"),     0),
            "semester":     _safe_str(c.get("semester"), "1st Semester"),
        })
        saved += 1

    try:
        batch.commit()
    except Exception as exc:
        logger.exception("Firestore batch commit failed")
        raise HTTPException(500, f"Database error during commit: {exc}")

    refresh_courses_cache()
    return {
        "committed": saved,
        "failed":    failed,
        "total":     len(courses),
    }