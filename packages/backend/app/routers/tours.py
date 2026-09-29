import re
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import any_authenticated
from app.core.firebase import db

router = APIRouter()

# Same document and field names the frontend already used (users/{uid} with
# toursSeen + hasSeenGlobalTours), so existing "seen" data keeps working.
USERS = "users"

# tourId ends up as a Firestore map key, so keep it to a safe charset.
TOUR_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class TourSeenRequest(BaseModel):
    tourId: str
    skipAll: bool = False   # user hit "Skip": stop auto-starting every tour


@router.get("/status")
def tour_status(user: dict = Depends(any_authenticated)):
    """Which tours this account has already seen. One doc read, keyed by the
    uid from the verified token, so a user can only ever read their own."""
    doc = db.collection(USERS).document(user["uid"]).get()
    data = doc.to_dict() if doc.exists else {}
    seen = data.get("toursSeen") or {}
    return {
        "hasSeenGlobalTours": bool(data.get("hasSeenGlobalTours")),
        "toursSeen": {k: True for k, v in seen.items() if v},
    }


@router.post("/seen")
def mark_tour_seen(req: TourSeenRequest, user: dict = Depends(any_authenticated)):
    """Record a finished or skipped tour for the signed-in account only."""
    if not TOUR_ID_RE.match(req.tourId):
        raise HTTPException(status_code=400, detail="Invalid tour id.")

    update = {"toursSeen": {req.tourId: True}}
    if req.skipAll:
        update["hasSeenGlobalTours"] = True

    # Readable labels so the doc is easy to identify in the Firestore console.
    # Taken from the verified token, never from the request body.
    # Labels only: never use these for auth checks, filtering, or joins.
    if user.get("email"):
        update["email"] = user["email"]
    if user.get("role"):
        update["role"] = user["role"]
    elif user.get("isCoordinator"):
        update["role"] = "coordinator"

    # merge=True never touches other fields on the user doc (role info etc.)
    db.collection(USERS).document(user["uid"]).set(update, merge=True)
    return {"ok": True}