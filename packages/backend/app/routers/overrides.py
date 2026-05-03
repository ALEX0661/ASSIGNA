import re
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import admin_only
from app.core.globals import schedule_dict

router = APIRouter()

# ── Merged-block helpers ───────────────────────────────────────────────────────

def _is_merged_id(schedule_id) -> bool:
    """Return True if this schedule_id follows the merged-event pattern (any letter suffix, e.g. '123-A', '456-B')."""
    return bool(re.search(r'-[A-Z]$', str(schedule_id or '')))


def _base_merged_id(schedule_id) -> str:
    """Strip any letter suffix to get the shared base id."""
    return re.sub(r'-[A-Z]$', '', str(schedule_id or ''))


def _are_merged_partners(ev_a: dict, ev_b: dict) -> bool:
    """
    Return True when two events are merge partners.

    Primary (positional) rule — matches the frontend's areMergePartners():
      Same courseCode + program + year + room + day + period, different block.

    Legacy schedule_id suffix rule (backward-compat with old -A/-B data):
      Both have a letter suffix and share the same numeric base id.
    """
    if not ev_a or not ev_b:
        return False

    # Positional rule
    if (
        ev_a.get("courseCode") and ev_a.get("courseCode") == ev_b.get("courseCode")
        and ev_a.get("program") and ev_a.get("program") == ev_b.get("program")
        and str(ev_a.get("year", "")) == str(ev_b.get("year", ""))
        and ev_a.get("block") != ev_b.get("block")
        and ev_a.get("room") and ev_a.get("room") not in ("TBA", "Online")
        and ev_a.get("room") == ev_b.get("room")
        and ev_a.get("day") and ev_a.get("day") == ev_b.get("day")
        and ev_a.get("period") and ev_a.get("period") == ev_b.get("period")
    ):
        return True

    # Legacy suffix rule
    sid_a = str(ev_a.get("schedule_id", ""))
    sid_b = str(ev_b.get("schedule_id", ""))
    if _is_merged_id(sid_a) and _is_merged_id(sid_b):
        return _base_merged_id(sid_a) == _base_merged_id(sid_b)

    return False


# ── Route ──────────────────────────────────────────────────────────────────────

@router.post("/session")
def override_session(data: dict, user=Depends(admin_only)):

    # 1. Identify the target event
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

    # 2. Conflict check
    new_room   = data.get("new_room")
    new_day    = data.get("new_day")
    new_period = data.get("new_period")

    if new_room and new_day and new_period:
        # Only check room conflicts if the room isn't virtual
        if new_room.lower() not in ("online", "tba"):
            for ev in schedule_dict.values():
                if ev is target:
                    continue

                # Build a provisional "target after move" for partner detection
                provisional_target = {**target, "room": new_room, "day": new_day, "period": new_period}
                if _are_merged_partners(provisional_target, ev):
                    continue

                if (ev.get("room") == new_room
                        and ev.get("day") == new_day
                        and ev.get("period") == new_period):
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "conflict": True,
                            "conflicting_event": {
                                "courseCode": ev.get("courseCode"),
                                "block":      ev.get("block"),
                                "session":    ev.get("session"),
                            },
                        },
                    )

    # 3. Apply changes and reset automation flags
    if new_day:
        target["day"] = new_day
    if new_period:
        target["period"] = new_period
    if new_room:
        target["room"] = new_room

    new_faculty = data.get("new_faculty")
    if new_faculty:
        target["faculty"] = new_faculty
        target["facultyAutoAssigned"] = False
        target["assignmentScore"] = None

    return {"overridden": True, "event": target}