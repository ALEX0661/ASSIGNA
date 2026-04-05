from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.firebase import db, refresh_faculty_cache
from app.core.globals import schedule_dict

router = APIRouter()

@router.get("/")
def get_all_faculty(user=Depends(admin_only)):
    docs = db.collection("faculty").stream()
    return [d.to_dict() | {"id": d.id} for d in docs]

@router.post("/add")
def add_faculty(data: dict, user=Depends(admin_only)):
    ref = db.collection("faculty").document()
    ref.set(data)
    refresh_faculty_cache()
    return {"id": ref.id}

@router.put("/update/{faculty_id}")
def update_faculty(faculty_id: str, data: dict, user=Depends(admin_only)):
    db.collection("faculty").document(faculty_id).update(data)
    refresh_faculty_cache()
    return {"updated": faculty_id}

@router.delete("/delete/{faculty_id}")
def delete_faculty(faculty_id: str, user=Depends(admin_only)):
    db.collection("faculty").document(faculty_id).delete()
    refresh_faculty_cache()
    return {"deleted": faculty_id}