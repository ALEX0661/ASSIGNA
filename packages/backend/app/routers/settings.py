from fastapi import APIRouter, Depends, HTTPException
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
    lecture = data.get("lecture") or []
    lab = data.get("lab") or []

    # A room can only be one type at a time -- the scheduler treats
    # "lecture" and "lab" as disjoint pools when it assigns sessions, so a
    # room listed in both would silently get double-booked (once as
    # someone's lecture slot, once as someone's lab slot, same room/time).
    # Catch it here, not just in the UI, since this endpoint can be hit
    # directly.
    overlap = sorted(set(lecture) & set(lab))
    if overlap:
        rooms_str = ", ".join(overlap)
        raise HTTPException(
            status_code=400,
            detail=f"{rooms_str} {'is' if len(overlap) == 1 else 'are'} listed as both Lecture and Lab. "
                   f"A room can only be one type — remove {'it' if len(overlap) == 1 else 'them'} from one list."
        )

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