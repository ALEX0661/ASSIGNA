from fastapi import APIRouter, Depends, HTTPException
from firebase_admin import auth as firebase_auth
from app.core.auth import admin_only, any_authenticated
from app.core.firebase import db, refresh_faculty_cache
from app.core.globals import schedule_dict
from app.models.faculty import Faculty, FacultyUpdate
import secrets
import string

router = APIRouter()

def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    return "".join(secrets.choice(alphabet) for _ in range(length))

@router.get("/")
def get_all_faculty(user=Depends(any_authenticated)):
    role = user.get("role")

    if role == "admin":
        docs = db.collection("faculty").stream()
        return [{**d.to_dict(), "id": d.id} for d in docs]

    uid = user.get("uid") or user.get("user_id")
    doc = db.collection("faculty").document(uid).get()
    if doc.exists:
        return [{**doc.to_dict(), "id": doc.id}]

    email = user.get("email", "")
    docs = db.collection("faculty").where("email", "==", email).limit(1).stream()
    results = [{**d.to_dict(), "id": d.id} for d in docs]
    return results

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
    name  = data.get("name", "").strip()

    if not email:
        raise HTTPException(400, "Email is required to create a faculty account.")

    temp_password = data.get("initial_password", "").strip() or _generate_temp_password()

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

    faculty_data = {k: v for k, v in data.items() if k != "initial_password"}
    ref = db.collection("faculty").document(uid)
    ref.set(faculty_data)
    refresh_faculty_cache()

    return {
        "id": uid,
        "message": "Faculty added and Firebase Auth account created.",
        "temp_password": temp_password,
        "note": "The faculty member must log out and back in if they already have a session.",
    }

@router.put("/update/{faculty_id}")
def update_faculty(faculty_id: str, data: FacultyUpdate, user=Depends(admin_only)):
    doc_ref = db.collection("faculty").document(faculty_id)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Faculty not found")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
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
    role = user.get("role")
    caller_uid = user.get("uid") or user.get("user_id")

    if role != "admin" and caller_uid != faculty_id:
        raise HTTPException(403, "You can only update your own preferences.")

    allowed = {"preferredDays", "preferredTimeStart", "preferredTimeEnd", "maxConsecutiveHours"}
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
                and event.get("block") == data.get("block")
                and event.get("session") == data.get("session")):
            event["faculty"]             = faculty_name
            event["facultyAutoAssigned"] = False
            event["assignmentScore"]     = None
            
    _recalculate_units(faculty_name, faculty_id)
    return {"assigned": faculty_name}
def _recalculate_units(faculty_name: str, faculty_id: str):
    count = sum(
        1 for e in schedule_dict.values()
        if e.get("faculty") == faculty_name and e.get("session") == "Lecture"
    )
    try:
        db.collection("faculty").document(faculty_id).update({"units": float(count)})
    except Exception:
        pass

@router.post("/link-auth")
def link_existing_auth_user(data: dict, user=Depends(admin_only)):
    uid        = data.get("uid", "").strip()
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
            new_ref = db.collection("faculty").document(uid)
            new_ref.set(old_doc.to_dict())
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
        "note": "Role claim set. The user must log out and back in for the new role to take effect.",
    }