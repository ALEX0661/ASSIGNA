from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from firebase_admin import auth as firebase_auth
from app.core.auth import admin_only, any_authenticated
from app.core.firebase import db, refresh_faculty_cache
from app.core.globals import schedule_dict
from app.core.unit_balancing import ( 
    compute_effective_max_units,
    build_faculty_load_map,
)
from app.models.faculty import Faculty, FacultyUpdate
import pandas as pd
import io
import base64
import re
import logging

logger = logging.getLogger("faculty")
router = APIRouter()


def _default_password(name: str) -> str:
    last_name = name.strip().split()[-1] if name.strip() else "Faculty"
    return f"{last_name}GC2026"



# Words that indicate a cell is still a template placeholder, not real data.
_PLACEHOLDER_TOKENS = frozenset({
    "last name", "lastname", "last_name",
    "first name", "firstname", "first_name", "firs name",
    "faculty name", "name", "surname", "given name",
    "faculty", "professor", "instructor",
})

def _is_placeholder(value: str) -> bool:
    """Return True if the value looks like unfilled template text."""
    cleaned = value.strip().lower()
    return not cleaned or cleaned == "nan" or cleaned in _PLACEHOLDER_TOKENS


def _parse_faculty_matrix(contents: bytes, sheet_names: list) -> list:
    import math
    faculty_map = {}

    def _is_name_cell(val) -> bool:
        """True if the cell looks like a real faculty name (not NaN, not a placeholder)."""
        s = str(val).strip().upper()
        return (
            bool(s)
            and s != "NAN"
            and "COURSE" not in s
            and "INSTRUCTION" not in s
            and "LAST NAME" not in s
            and "FIRST NAME" not in s
            and "TITLE" not in s
            and "DESC" not in s
        )

    for sheet_name in sheet_names:
        status = "part-time" if "part" in sheet_name.lower() else "full-time"

        try:
            df_raw = pd.read_excel(io.BytesIO(contents), sheet_name=sheet_name, header=None)
        except Exception:
            continue

        if df_raw.shape[0] < 2 or df_raw.shape[1] < 3:
            continue

        # ── 1. Dynamically find column indices (Protected Search) ───────────────
        header_row_idx = None
        code_col_idx   = 0
        title_col_idx  = 1
        
        for i in range(min(15, len(df_raw))):
            row_strs = [str(x).strip().upper() for x in df_raw.iloc[i]]
            found_code = False
            for col_i, val in enumerate(row_strs):
                
                # Protect against placeholders hijacking the column index
                is_placeholder = "LAST" in val or "FIRST" in val or "FACULTY" in val
                
                if "CODE" in val and not is_placeholder:
                    header_row_idx = i
                    code_col_idx = col_i
                    found_code = True
                    
                elif ("TITLE" in val or "DESC" in val or "NAME" in val) and not is_placeholder:
                    title_col_idx = col_i
            
            if found_code:
                break

        if header_row_idx is None:
            continue
            
        # Faculty names start after the code and title columns
        faculty_start_idx = max(code_col_idx, title_col_idx) + 1

        # ── 2. Detect layout ──────────────────────────────────────────────────
        layout_a = (
            header_row_idx > 0
            and df_raw.shape[1] > faculty_start_idx
            and _is_name_cell(df_raw.iloc[header_row_idx - 1, faculty_start_idx])
        )

        if layout_a:
            last_names_series  = df_raw.iloc[header_row_idx - 1]
            first_names_series = df_raw.iloc[header_row_idx]
            course_start       = header_row_idx + 1
        else:
            last_names_series = df_raw.iloc[header_row_idx]
            if header_row_idx + 1 < len(df_raw):
                next_b = str(df_raw.iloc[header_row_idx + 1, title_col_idx]).strip().upper()
                has_faculty_label = ("FACULTY" in next_b or "FULL" in next_b or "PART" in next_b)
            else:
                has_faculty_label = False

            if has_faculty_label:
                first_names_series = df_raw.iloc[header_row_idx + 1]
                course_start       = header_row_idx + 2
            else:
                first_names_series = None
                course_start       = header_row_idx + 1

        # ── 3. Parse Faculty and Ratings ──────────────────────────────────────
        for col_idx in range(faculty_start_idx, df_raw.shape[1]):
            raw_last = re.sub(r"\.\d+$", "", str(last_names_series.iloc[col_idx])).rstrip(",").strip().upper()

            if _is_placeholder(raw_last) or raw_last == "NAN":
                continue

            if first_names_series is not None:
                raw_first = str(first_names_series.iloc[col_idx]).strip().upper()
                if _is_placeholder(raw_first) or raw_first == "NAN":
                    continue
                full_name = f"{raw_last}, {raw_first}"
            else:
                full_name = raw_last

            if full_name not in faculty_map:
                faculty_map[full_name] = {
                    "name":            full_name,
                    "status":          status,
                    "specializations": [],
                }

            for row_idx in range(course_start, len(df_raw)):
                raw_code    = df_raw.iloc[row_idx, code_col_idx]
                course_code = str(raw_code).strip() if pd.notna(raw_code) else ""
                if not course_code or course_code.lower() == "nan":
                    continue

                raw_title    = df_raw.iloc[row_idx, title_col_idx] if df_raw.shape[1] > title_col_idx else None
                course_title = str(raw_title).strip() if pd.notna(raw_title) and str(raw_title).strip().lower() != "nan" else ""

                try:
                    cell_val = df_raw.iloc[row_idx, col_idx]
                    if pd.isna(cell_val):
                        continue
                    rating = int(float(cell_val))
                except (ValueError, TypeError):
                    continue

                if rating < 1 or rating > 5:
                    continue

                spec_entry = {"courseCode": course_code, "rating": rating}
                if course_title:
                    spec_entry["courseTitle"] = course_title
                    spec_entry["title"] = course_title

                faculty_map[full_name]["specializations"].append(spec_entry)

    return list(faculty_map.values())


@router.get("/")
def get_all_faculty(include_archived: bool = False, user=Depends(any_authenticated)):
    role = user.get("role")

    if role == "admin":
        docs   = db.collection("faculty").stream()
        result = [{**d.to_dict(), "id": d.id} for d in docs]
        if not include_archived:
            result = [f for f in result if not f.get("archived", False)]
        return result

    uid = user.get("uid") or user.get("user_id")
    doc = db.collection("faculty").document(uid).get()
    if doc.exists:
        return [{**doc.to_dict(), "id": doc.id}]

    email = user.get("email", "")
    docs  = db.collection("faculty").where("email", "==", email).limit(1).stream()
    return [{**d.to_dict(), "id": d.id} for d in docs]


@router.get("/me")
def get_my_profile(user=Depends(any_authenticated)):
    uid = user.get("uid") or user.get("user_id")
    doc = db.collection("faculty").document(uid).get()
    if doc.exists:
        return {**doc.to_dict(), "id": doc.id}
    raise HTTPException(404, "Faculty profile not found")


@router.get("/{faculty_id}")
def get_faculty(faculty_id: str, user=Depends(any_authenticated)):
    doc = db.collection("faculty").document(faculty_id).get()
    if not doc.exists:
        raise HTTPException(404, "Faculty not found")
    return {**doc.to_dict(), "id": doc.id}


@router.post("/add")
def add_faculty(data: dict, user=Depends(admin_only)):
    email = data.get("email", "").strip()
    name  = data.get("name",  "").strip()

    if not email:
        raise HTTPException(400, "Email is required to create a faculty account.")

    temp_password = data.get("initial_password", "").strip() or _default_password(name)

    try:
        auth_user = firebase_auth.create_user(
            email=email,
            password=temp_password,
            display_name=name,
        )
        uid = auth_user.uid
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(400, f"A Firebase Auth account already exists for {email}.")
    except Exception as exc:
        raise HTTPException(400, f"Could not create auth user: {exc}")

    try:
        firebase_auth.set_custom_user_claims(uid, {"role": "faculty"})
    except Exception as exc:
        firebase_auth.delete_user(uid)
        raise HTTPException(500, f"Could not set role claim: {exc}")

    status      = data.get("status", "full-time")
    initial_max = compute_effective_max_units(status, 0)

    faculty_data = {k: v for k, v in data.items() if k != "initial_password"}
    faculty_data["max_units"] = initial_max
    faculty_data.setdefault("archived", False)

    db.collection("faculty").document(uid).set(faculty_data)
    refresh_faculty_cache()

    return {
        "id":            uid,
        "message":       "Faculty added and Firebase Auth account created.",
        "temp_password": temp_password,
        "note":          "The faculty member must log out and back in if they already have a session.",
        "max_units":     initial_max,
    }


@router.put("/update/{faculty_id}")
def update_faculty(faculty_id: str, data: FacultyUpdate, user=Depends(any_authenticated)):
    role       = user.get("role")
    caller_uid = user.get("uid") or user.get("user_id")

    if role != "admin" and caller_uid != faculty_id:
        raise HTTPException(403, "You can only update your own profile.")
    # -------------------------------

    doc_ref = db.collection("faculty").document(faculty_id)
    doc     = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Faculty not found")

    update_data = {k: v for k, v in data.dict().items() if v is not None}

    

    if "firstName" in update_data or "lastName" in update_data:
        existing   = doc.to_dict() or {}
        first_name = update_data.get("firstName", existing.get("firstName", "")).strip().upper()
        last_name  = update_data.get("lastName",  existing.get("lastName",  "")).strip().upper()
        if first_name and last_name:
            update_data["name"] = f"{last_name}, {first_name}"
        elif last_name:
            update_data["name"] = last_name
        elif first_name:
            update_data["name"] = first_name

    if "status" in update_data:
        existing   = doc.to_dict() or {}
        new_status = update_data["status"]
        load_map     = build_faculty_load_map(schedule_dict)
        course_count = load_map.get(existing.get("name", ""), {}).get("course_count", 0)
        update_data["max_units"] = compute_effective_max_units(new_status, course_count)

    doc_ref.update(update_data)

    if "name" in update_data:
        try:
            firebase_auth.update_user(faculty_id, display_name=update_data["name"])
        except Exception:
            pass

    if "email" in update_data:
        try:
            firebase_auth.update_user(faculty_id, email=update_data["email"])
        except Exception:
            pass

    refresh_faculty_cache()
    return {"updated": faculty_id}


@router.delete("/delete/{faculty_id}")
def delete_faculty(faculty_id: str, user=Depends(admin_only)):
    doc_ref = db.collection("faculty").document(faculty_id)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Faculty not found")

    doc_ref.delete()

    try:
        firebase_auth.delete_user(faculty_id)
    except firebase_auth.UserNotFoundError:
        pass
    except Exception as exc:
        refresh_faculty_cache()
        return {
            "deleted": faculty_id,
            "warning": f"Firestore record deleted but Auth user removal failed: {exc}",
        }

    refresh_faculty_cache()
    return {"deleted": faculty_id}


@router.put("/preferences/{faculty_id}")
def update_preferences(faculty_id: str, data: dict, user=Depends(any_authenticated)):
    role       = user.get("role")
    caller_uid = user.get("uid") or user.get("user_id")

    if role != "admin" and caller_uid != faculty_id:
        raise HTTPException(403, "You can only update your own preferences.")

    allowed     = {"preferredDays", "preferredTimeStart", "preferredTimeEnd"}
    update_data = {k: v for k, v in data.items() if k in allowed}
    if not update_data:
        raise HTTPException(400, "No valid preference fields provided")

    db.collection("faculty").document(faculty_id).update(update_data)
    refresh_faculty_cache()
    return {"updated": faculty_id}


@router.post("/assign")
def assign_faculty(data: dict, user=Depends(admin_only)):
    faculty_name = data.get("faculty_name")
    faculty_id   = data.get("faculty_id")

    for event in schedule_dict.values():
        if (event.get("courseCode") == data.get("courseCode")
                and event.get("block")    == data.get("block")
                and event.get("session")  == data.get("session")):
            event["faculty"]             = faculty_name
            event["facultyAutoAssigned"] = False
            event["assignmentScore"]     = None

    _recalculate_units(faculty_name, faculty_id)
    return {"assigned": faculty_name}


def _recalculate_units(faculty_name: str, faculty_id: str):
    load_map = build_faculty_load_map(schedule_dict)
    load     = load_map.get(faculty_name, {"assigned_units": 0, "course_count": 0})

    assigned_units = load["assigned_units"]
    course_count   = load["course_count"]

    try:
        doc    = db.collection("faculty").document(faculty_id).get()
        status = doc.to_dict().get("status", "full-time") if doc.exists else "full-time"
    except Exception:
        status = "full-time"

    effective_max = compute_effective_max_units(status, course_count)

    try:
        db.collection("faculty").document(faculty_id).update({
            "units":     assigned_units,
            "max_units": effective_max,
        })
    except Exception:
        pass


@router.post("/link-auth")
def link_existing_auth_user(data: dict, user=Depends(admin_only)):
    uid        = data.get("uid",        "").strip()
    old_doc_id = data.get("old_doc_id", "").strip()

    if not uid:
        raise HTTPException(400, "uid is required")

    try:
        auth_user = firebase_auth.get_user(uid)
    except firebase_auth.UserNotFoundError:
        raise HTTPException(404, f"No Firebase Auth user found with UID {uid}")

    firebase_auth.set_custom_user_claims(uid, {"role": "faculty"})

    if old_doc_id and old_doc_id != uid:
        old_ref = db.collection("faculty").document(old_doc_id)
        old_doc = old_ref.get()
        if old_doc.exists:
            db.collection("faculty").document(uid).set(old_doc.to_dict())
            old_ref.delete()
        else:
            db.collection("faculty").document(uid).set({
                "name":  auth_user.display_name or "",
                "email": auth_user.email or "",
            })
    elif not old_doc_id:
        existing = db.collection("faculty").document(uid).get()
        if not existing.exists:
            db.collection("faculty").document(uid).set({
                "name":  auth_user.display_name or "",
                "email": auth_user.email or "",
            })

    refresh_faculty_cache()
    return {
        "linked": uid,
        "note":   "Role claim set. The user must log out and back in for the new role to take effect.",
    }


@router.post("/upload")
async def upload_faculty_excel(file: UploadFile = File(...), user=Depends(admin_only)):
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(400, "Please upload an .xlsx or .xls file.")

    # Guard against pointer issues reading stream content
    await file.seek(0)
    contents = await file.read()

    try:
        xl     = pd.ExcelFile(io.BytesIO(contents))
        sheets = xl.sheet_names
    except Exception:
        raise HTTPException(400, "Invalid Excel file or corrupted data.")

    return {
        "sheets":   sheets,
        "fileData": base64.b64encode(contents).decode("utf-8"),
    }


@router.post("/upload/extract")
def extract_faculty_sheet(data: dict, user=Depends(admin_only)):
    file_data   = data.get("fileData")
    sheet_names = data.get("sheetNames")

    if not file_data or not sheet_names:
        raise HTTPException(400, "Missing fileData or sheetNames.")

    try:
        contents = base64.b64decode(file_data)

        if sheet_names == ["all"]:
            xl          = pd.ExcelFile(io.BytesIO(contents))
            sheet_names = xl.sheet_names

        faculty = _parse_faculty_matrix(contents, sheet_names)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(400, f"Failed to extract faculty data: {exc}")

    return {"preview": faculty, "count": len(faculty)}


@router.post("/upload/commit")
def commit_faculty_upload(data: dict, user=Depends(admin_only)):
    faculty_list = data.get("faculty", [])
    if not faculty_list:
        raise HTTPException(400, "No faculty records provided.")

    saved  = 0
    failed = []
    batch  = db.batch()

    for f in faculty_list:
        name   = (f.get("name") or "").strip()
        status = f.get("status", "full-time")

        if not name:
            failed.append({"faculty": f, "reason": "Missing name"})
            continue

        doc_id = re.sub(r"[^A-Z0-9]", "_", name.upper())[:120]
        ref    = db.collection("faculty").document(doc_id)

        initial_max = compute_effective_max_units(status, 0)

        batch.set(
            ref,
            {
                "name":               name,
                "status":             status,
                "specializations":    f.get("specializations", []),
                "units":              0.0,
                "max_units":          initial_max,
                "preferredDays":      [],
                "preferredTimeStart": 7.0,
                "preferredTimeEnd":   21.0,
                "archived":           False,
            },
            merge=True,
        )
        saved += 1

    try:
        batch.commit()
    except Exception as exc:
        logger.exception("Faculty batch commit failed")
        raise HTTPException(500, f"Database error during commit: {exc}")

    refresh_faculty_cache()
    return {"committed": saved, "failed": failed, "total": len(faculty_list)}


@router.put("/credentials/{faculty_id}")
def update_faculty_credentials(faculty_id: str, data: dict, user=Depends(admin_only)):
    email    = (data.get("email")    or "").strip()
    password = (data.get("password") or "").strip()

    if not email and not password:
        raise HTTPException(400, "Provide at least an email or a new password.")
    if password and len(password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters.")

    doc_ref = db.collection("faculty").document(faculty_id)
    doc     = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Faculty record not found.")

    faculty_data = doc.to_dict() or {}

    try:
        firebase_auth.get_user(faculty_id)
        update_kwargs = {}
        if email:
            update_kwargs["email"]          = email
            update_kwargs["email_verified"] = False
        if password:
            update_kwargs["password"] = password
        if update_kwargs:
            firebase_auth.update_user(faculty_id, **update_kwargs)
        if email and email != faculty_data.get("email"):
            doc_ref.update({"email": email})
        refresh_faculty_cache()
        return {"updated": faculty_id, "migrated": False}

    except firebase_auth.UserNotFoundError:
        pass 

    if not email:
        raise HTTPException(
            400,
            "This faculty member has no login account yet. "
            "An email address is required to create one."
        )

    auto_generated   = not password
    display_password = password or _default_password(faculty_data.get("name", "Faculty"))

    try:
        auth_user = firebase_auth.create_user(
            email=email,
            password=display_password,
            display_name=faculty_data.get("name", ""),
        )
        new_uid = auth_user.uid
    except firebase_auth.EmailAlreadyExistsError:
        raise HTTPException(400, f"A Firebase Auth account already exists for '{email}'.")
    except Exception as exc:
        raise HTTPException(400, f"Could not create Auth account: {exc}")

    try:
        firebase_auth.set_custom_user_claims(new_uid, {"role": "faculty"})
    except Exception as exc:
        firebase_auth.delete_user(new_uid)
        raise HTTPException(500, f"Could not assign faculty role: {exc}")

    new_data = {**faculty_data, "email": email}
    db.collection("faculty").document(new_uid).set(new_data)
    doc_ref.delete()

    refresh_faculty_cache()
    return {
        "updated":        new_uid,
        "migrated":       True,
        "old_id":         faculty_id,
        "new_id":         new_uid,
        "temp_password":  display_password if auto_generated else None,
    }