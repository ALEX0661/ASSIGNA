from fastapi import APIRouter, Depends
from app.core.auth import admin_only
from app.core.firebase import db, refresh_rooms_cache, refresh_time_cache, refresh_days_cache

router = APIRouter()


# ── Rooms ─────────────────────────────────────────────────────────────────────

@router.get("/rooms")
def get_rooms(user=Depends(admin_only)):
    doc = db.collection("rooms").document("rooms").get()
    if doc.exists:
        return doc.to_dict()
    return {"lecture": [], "lab": []}


@router.post("/rooms")
def save_rooms(data: dict, user=Depends(admin_only)):
    db.collection("rooms").document("rooms").set(data)
    refresh_rooms_cache()
    return {"saved": True}


# ── Days ──────────────────────────────────────────────────────────────────────

@router.get("/days")
def get_days(user=Depends(admin_only)):
    doc = db.collection("settings").document("days").get()
    if doc.exists:
        return doc.to_dict()
    return {"days": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]}


@router.post("/days")
def save_days(data: dict, user=Depends(admin_only)):
    db.collection("settings").document("days").set(data)
    refresh_days_cache()
    return {"saved": True}


# ── Time window ───────────────────────────────────────────────────────────────

@router.get("/time")
def get_time(user=Depends(admin_only)):
    doc = db.collection("settings").document("time").get()
    if doc.exists:
        return doc.to_dict()
    return {"start_time": 7, "end_time": 21}


@router.post("/time")
def save_time(data: dict, user=Depends(admin_only)):
    db.collection("settings").document("time").set(data)
    refresh_time_cache()
    return {"saved": True}
