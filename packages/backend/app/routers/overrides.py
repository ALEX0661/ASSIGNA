from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import admin_only
from app.core.globals import schedule_dict

router = APIRouter()


@router.post("/session")
def override_session(data: dict, user=Depends(admin_only)):
   # 1. Identify the target event
    # Ensure sid is a string to match the dictionary keys created in scheduler.py
    sid = data.get("schedule_id")
    target = schedule_dict.get(str(sid))

    # Fallback: search by code/block/session if id is missing or not found
    if not target:
        for ev in schedule_dict.values():
            if (ev.get("courseCode") == data.get("courseCode")
                    and ev.get("block") == data.get("block")
                    and ev.get("session") == data.get("session")):
                target = ev
                break

    if target is None:
        raise HTTPException(404, "Session not found in current schedule")

    # 2. Conflict check (Iterate over .values() since it is now a dictionary)
    new_room = data.get("new_room")
    new_day = data.get("new_day")
    new_period = data.get("new_period")

    if new_room and new_day and new_period:
        # Optimization: Only check for conflicts if the room isn't "Online"
        if new_room.lower() != "online":
            for ev in schedule_dict.values():
                if ev is target: 
                    continue
                # If the room, day, and time match, it's a conflict
                if (ev.get("room") == new_room
                        and ev.get("day") == new_day
                        and ev.get("period") == new_period):
                    raise HTTPException(
                        status_code=409, 
                        detail={
                            "conflict": True,
                            "conflicting_event": {
                                "courseCode": ev.get("courseCode"),
                                "block": ev.get("block"),
                                "session": ev.get("session")
                            }
                        }
                    )

    # 3. Apply changes and reset automation flags
    if new_day: 
        target["day"] = new_day
    if new_period: 
        target["period"] = new_period
    if new_room: 
        target["room"] = new_room
        
    # If faculty is changed, mark it as NOT auto-assigned
    new_faculty = data.get("new_faculty")
    if new_faculty:
        target["faculty"] = new_faculty
        target["facultyAutoAssigned"] = False
        target["assignmentScore"] = None
        
    return {"overridden": True, "event": target}
