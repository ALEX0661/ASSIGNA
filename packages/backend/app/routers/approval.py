import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from google.cloud import firestore

from app.core.auth import admin_only
from app.core.firebase import db
from app.core.globals import schedule_dict
from app.core.event_cache import event_cache
from app.core.audit import log_audit_event

router = APIRouter()

class RejectRequest(BaseModel):
    feedback: str

class EditScheduleRequest(BaseModel):
    schedule: List[Dict[str, Any]]

def _get_schedule_or_404(schedule_id: str):
    doc = db.collection("coordinator_schedules").document(schedule_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return doc.to_dict()

def _advance_queue(queue_data: dict, queue_id: str):
    """Advance the queue to the next waiting program.
    Uses the same flat programStatus dict as queue.py."""
    queue_list = queue_data.get("queue", [])
    program_status = queue_data.get("programStatus", {})
    current_index = queue_data.get("currentTurnIndex", 0)

    # Self-healing guard: if the outgoing program is still marked "active"
    # at this point, the caller forgot to set its resulting status (e.g.
    # approved/skipped) before advancing. Default it to "skipped" rather
    # than silently leaving it "active" forever.
    if 0 <= current_index < len(queue_list):
        outgoing = queue_list[current_index]
        if program_status.get(outgoing) == "active":
            program_status[outgoing] = "skipped"

    n = len(queue_list)
    next_index = -1

    if n > 0:
        # Pass 1: anyone still "waiting" further ahead.
        for offset in range(1, n + 1):
            i = (current_index + offset) % n
            if program_status.get(queue_list[i]) == "waiting":
                next_index = i
                break

        # Pass 2: nobody's "waiting" anymore -- loop back and give
        # "skipped" programs another turn instead of ending the queue the
        # moment everyone's been skipped once. Mirrors queue.py's
        # _advance_to_next -- keep the two in sync.
        if next_index == -1:
            for offset in range(1, n + 1):
                i = (current_index + offset) % n
                if program_status.get(queue_list[i]) == "skipped":
                    next_index = i
                    break

    now = (datetime.utcnow().isoformat() + "Z")
    if next_index != -1:
        program_status[queue_list[next_index]] = "active"
        updates = {
            "programStatus": program_status,
            "currentTurnIndex": next_index,
            "updatedAt": now
        }
    else:
        updates = {
            "programStatus": program_status,
            "status": "completed",
            "updatedAt": now
        }

    db.collection("coordinator_queues").document(queue_id).update(updates)
    return updates


def _get_or_create_master(queue_id: str, semester: str, academic_year: str):
    """Master schedule doc now holds METADATA ONLY.
    Actual events live in the 'events' subcollection to avoid the
    1 MiB Firestore document size limit."""
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if docs:
        return docs[0].id, docs[0].to_dict()

    master_id = str(uuid.uuid4())
    master_data = {
        "masterId": master_id,
        "queueId": queue_id,
        "semester": semester,
        "academicYear": academic_year,
        "approvedPrograms": [],
        "status": "building",
        "createdAt": (datetime.utcnow().isoformat() + "Z"),
        "updatedAt": (datetime.utcnow().isoformat() + "Z"),
        "finalizedAt": None
    }
    db.collection("master_schedules").document(master_id).set(master_data)
    return master_id, master_data


def _replace_all_events(events_ref, events: list, known_existing_ids=None):
    """Replace all events in a subcollection using generic 500-event chunks."""
    _delete_subcollection(events_ref)
    
    batch = db.batch()
    chunk_size = 500
    count = 0
    
    for i in range(0, max(1, len(events)), chunk_size):
        chunk = events[i:i+chunk_size]
        for ev in chunk:
            if not ev.get("schedule_id"):
                ev["schedule_id"] = str(uuid.uuid4())
        
        chunk_id = f"chunk_{i//chunk_size}"
        batch.set(events_ref.document(chunk_id), {"events": chunk})
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0
            
    if count:
        batch.commit()

def _replace_program_events(events_ref, program_code: str, events: list):
    """Update a specific program's events within the chunked architecture."""
    master_ref = events_ref.parent
    all_events = _get_master_events(master_ref)
    
    retained_events = [ev for ev in all_events if ev.get("programCode") != program_code]
    
    for ev in events:
        ev["programCode"] = program_code
        ev_id = ev.get('schedule_id') or str(uuid.uuid4())
        if not str(ev_id).startswith(f"{program_code}_"):
            ev_id = f"{program_code}_{ev_id}"
        ev["schedule_id"] = ev_id
        retained_events.append(ev)
        
    _replace_all_events(events_ref, retained_events)

def _delete_subcollection(coll_ref):
    """Same helper as schedule.py — duplicated here because approval.py
    doesn't import from schedule.py (avoids circular imports)."""
    batch = db.batch()
    count = 0
    for doc in coll_ref.stream():
        batch.delete(doc.reference)
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()

def _get_master_events(master_ref, cache_key: str = None):
    if cache_key:
        cached = event_cache.get(cache_key)
        if cached is not None:
            return cached
            
    events = []
    for doc in master_ref.collection("events").stream():
        data = doc.to_dict()
        if "events" in data:
            events.extend(data["events"])
        else:
            ev = data
            if "schedule_id" not in ev:
                ev["schedule_id"] = doc.id
            events.append(ev)
            
    if cache_key:
        event_cache.put(cache_key, events)
    return events


@router.get("/submitted")
def get_submitted_schedules(user: dict = Depends(admin_only)):
    # Was hardcoded to status == "submitted", so an approved schedule
    # dropped out of this list the instant it was approved — the admin
    # dashboard's "Approved" section, activity feed, and approved-count
    # tile all read from this one endpoint, so all of them silently went
    # empty. "in" pulls both statuses; the frontend still splits them
    # into pending/approved buckets itself.
    #
    # Removed active queue scoping per user request, so past submissions don't disappear when a new queue starts
    query = db.collection("coordinator_schedules").where("status", "in", ["submitted", "approved"])
    docs = query.get()
    results = []
    for doc in docs:
        data = doc.to_dict()
        results.append({
            "scheduleId": data.get("scheduleId"),
            "name": data.get("name"),
            "programCode": data.get("programCode"),
            "coordinatorId": data.get("coordinatorId"),
            "semester": data.get("semester"),
            "academicYear": data.get("academicYear"),
            # Missing "status" was the other half of the bug: the frontend
            # buckets rows with `s.status === 'submitted' / 'approved'`, so
            # with this field absent every row fell into neither bucket
            # and the whole list rendered as if nothing had been submitted,
            # even once the wrapper-key mismatch below is fixed.
            "status": data.get("status"),
            "submittedAt": data.get("submittedAt"),
            "approvedAt": data.get("approvedAt"),
            "eventCount": len(data.get("schedule", [])),
            "queueId": data.get("queueId")
        })
    return {"submitted": results}

@router.get("/schedule/{schedule_id}")
def get_schedule(schedule_id: str, user: dict = Depends(admin_only)):
    data = _get_schedule_or_404(schedule_id)
    # Load into schedule_dict so override engine works
    schedule_dict.clear()
    for ev in data.get("schedule", []):
        schedule_dict[str(ev.get("schedule_id", uuid.uuid4()))] = ev
    return data

@router.post("/schedule/{schedule_id}/approve")
def approve_schedule(schedule_id: str, user: dict = Depends(admin_only)):
    schedule_data = _get_schedule_or_404(schedule_id)
    if schedule_data.get("status") != "submitted":
        raise HTTPException(status_code=400, detail="Schedule is not in submitted status")

    now = (datetime.utcnow().isoformat() + "Z")
    db.collection("coordinator_schedules").document(schedule_id).update({
        "status": "approved",
        "approvedAt": now,
        "approvedBy": user.get("uid")
    })

    queue_id = schedule_data.get("queueId")
    if not queue_id:
        ay = schedule_data.get("academicYear")
        sem = schedule_data.get("semester")
        q_docs = db.collection("coordinator_queues").where("academicYear", "==", ay).where("semester", "==", sem).get()
        if not q_docs:
            raise HTTPException(status_code=400, detail="Schedule has no queueId and no matching queue found")
        queue_id = q_docs[0].id
        db.collection("coordinator_schedules").document(schedule_id).update({
            "queueId": queue_id
        })

    # Prevent approval if the master schedule is finalized
    mdocs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if mdocs and mdocs[0].to_dict().get("status") == "finalized":
        raise HTTPException(status_code=400, detail="Cannot approve schedule because the master schedule is finalized. Unpublish the master schedule first.")

    queue_doc = db.collection("coordinator_queues").document(queue_id).get()
    if not queue_doc.exists:
        raise HTTPException(status_code=404, detail="Queue not found")

    queue_data = queue_doc.to_dict()
    program_status = queue_data.get("programStatus", {})
    program_code = schedule_data.get("programCode")

    # Mark this program as approved
    program_status[program_code] = "approved"
    queue_data["programStatus"] = program_status

    # Only move the turn forward if the program being approved is actually
    # the one currently holding the turn. Without this check, re-approving
    # a schedule after an unapprove (where the turn had already moved on
    # to someone else) would call _advance_queue anyway -- which advances
    # from whatever currentTurnIndex happens to be right now, silently
    # skipping past whoever's actual turn it is. Approving out-of-turn
    # should just record the approval, not touch anyone else's turn.
    queue_list = queue_data.get("queue", [])
    current_index = queue_data.get("currentTurnIndex", -1)
    is_current_turn = 0 <= current_index < len(queue_list) and queue_list[current_index] == program_code

    if is_current_turn:
        updates = _advance_queue(queue_data, queue_id)
    else:
        db.collection("coordinator_queues").document(queue_id).update({
            "programStatus": program_status,
            "updatedAt": now
        })
        updates = {"programStatus": program_status, "updatedAt": now}

    master_id, master_data = _get_or_create_master(
        queue_id,
        schedule_data.get("semester"),
        schedule_data.get("academicYear")
    )

    master_ref = db.collection("master_schedules").document(master_id)
    events_ref = master_ref.collection("events")

    events = schedule_data.get("schedule", [])
    _replace_program_events(events_ref, program_code, events)

    approved_progs = master_data.get("approvedPrograms", [])
    if program_code not in approved_progs:
        approved_progs.append(program_code)

    master_ref.update({
        "approvedPrograms": approved_progs,
        "updatedAt": now
    })
    event_cache.invalidate(f"master:{master_id}")

    log_audit_event(queue_id, "SCHEDULE_APPROVED", user, target_program=program_code, details=f"Approved {program_code}'s schedule")
    return {"message": "Schedule approved successfully", "queue_updates": updates}

@router.post("/schedule/{schedule_id}/reject")
def reject_schedule(schedule_id: str, req: RejectRequest, user: dict = Depends(admin_only)):
    schedule_data = _get_schedule_or_404(schedule_id)
    if schedule_data.get("status") != "submitted":
        raise HTTPException(status_code=400, detail="Schedule is not in submitted status")

    db.collection("coordinator_schedules").document(schedule_id).update({
        "status": "draft",
        "submittedAt": None,
        "rejectionFeedback": req.feedback,
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    })

    # Without this, the program stayed marked "submitted" in the queue's
    # status rail forever after a rejection, even though they're back to
    # editing a draft — leaving everyone else looking at a stale status.
    queue_id = schedule_data.get("queueId")
    program_code = schedule_data.get("programCode")
    if queue_id and program_code:
        queue_ref = db.collection("coordinator_queues").document(queue_id)
        queue_doc = queue_ref.get()
        if queue_doc.exists and queue_doc.to_dict().get("programStatus", {}).get(program_code) == "submitted":
            queue_ref.update({
                f"programStatus.{program_code}": "active",
                "status": "active",
                "updatedAt": (datetime.utcnow().isoformat() + "Z")
            })

    if queue_id and program_code:
        log_audit_event(queue_id, "SCHEDULE_REJECTED", user, target_program=program_code, details=f"Rejected {program_code}'s schedule: {req.feedback}")

    return {"message": "Schedule rejected"}

@router.get("/master/{queue_id}")
def get_master_schedule(queue_id: str, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        return {}
    master_doc = docs[0]
    data = master_doc.to_dict()
    data["schedule"] = _get_master_events(master_doc.reference, cache_key=f"master:{master_doc.id}")
    return data

@router.post("/schedule/{schedule_id}/unapprove")
def unapprove_schedule(schedule_id: str, req: RejectRequest, user: dict = Depends(admin_only)):
    doc = db.collection("coordinator_schedules").document(schedule_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Schedule not found")
    data = doc.to_dict()
    ay = data.get("academicYear")
    sem = data.get("semester")
    prog = data.get("programCode")
    queue_id = data.get("queueId")
    
    # Prevent unapproval if the master schedule is finalized
    if queue_id:
        mdocs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
        if mdocs and mdocs[0].to_dict().get("status") == "finalized":
            raise HTTPException(status_code=400, detail="Cannot unapprove schedule because the master schedule is finalized. Unpublish the master schedule first.")

    doc.reference.update({
        "status": "draft",
        "approvedAt": firestore.DELETE_FIELD,
        "approvedBy": firestore.DELETE_FIELD,
        "submittedAt": firestore.DELETE_FIELD,
        "unfinalizedNote": f"Dean unapproved this schedule: {req.feedback}",
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    })
    
    # Update queue status using the stored queueId
    if queue_id:
        queue_ref = db.collection("coordinator_queues").document(queue_id)
        queue_doc = queue_ref.get()
        if queue_doc.exists:
            program_status = queue_doc.to_dict().get("programStatus", {})
            program_status[prog] = "waiting"
            queue_ref.update({
                "status": "active",
                "programStatus": program_status,
                "updatedAt": (datetime.utcnow().isoformat() + "Z")
            })
            
            # Remove from master schedule
            mdocs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
            if mdocs:
                md = mdocs[0]
                mref = md.reference
                _replace_program_events(mref.collection("events"), prog, [])
                mref.update({
                    "approvedPrograms": firestore.ArrayRemove([prog]),
                    "updatedAt": (datetime.utcnow().isoformat() + "Z")
                })
                event_cache.invalidate(f"master:{md.id}")
    
    if queue_id and prog:
        log_audit_event(queue_id, "SCHEDULE_UNAPPROVED", user, target_program=prog, details=f"Unapproved {prog}'s schedule. Note: {req.feedback}")
    return {"message": "Schedule unapproved"}

@router.put("/master/{queue_id}/edit")
def admin_edit_master_schedule(queue_id: str, payload: EditScheduleRequest, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        raise HTTPException(status_code=404, detail="Master schedule not found")
    master_ref = docs[0].reference
    cache_key = f"master:{docs[0].id}"
    old_events = _get_master_events(master_ref, cache_key=cache_key)
    
    # Pass known IDs so _replace_all_events can delete by ID (0 reads).
    old_ids = [str(ev.get("schedule_id")) for ev in old_events if ev.get("schedule_id")]
    _replace_all_events(master_ref.collection("events"), payload.schedule, known_existing_ids=old_ids)
    master_ref.update({"updatedAt": firestore.SERVER_TIMESTAMP})
    event_cache.invalidate(cache_key)
    
    diff_details = _generate_schedule_diff(old_events, payload.schedule)
    if diff_details and diff_details != "Edited schedule (no class changes)":
        log_audit_event(queue_id, "MASTER_SCHEDULE_EDITED", user, target_program="Master", details=diff_details)
        
    return {"message": "Master schedule updated"}

@router.post("/master/{queue_id}/finalize")
def finalize_master_schedule(queue_id: str, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        raise HTTPException(status_code=404, detail="Master schedule not found")

    master_doc = docs[0]
    master_id = master_doc.id
    master_data = master_doc.to_dict()

    now = (datetime.utcnow().isoformat() + "Z")
    master_ref = master_doc.reference
    master_ref.update({
        "status": "finalized",
        "finalizedAt": now,
        "updatedAt": now
    })

    semester = master_data.get("semester")
    academic_year = master_data.get("academicYear")
    
    if semester and academic_year:
        final_name = f"A.Y. {academic_year}, {semester}".strip()
    else:
        final_name = f"{semester} {academic_year} - Final".strip()

    if semester and academic_year:
        other_docs = db.collection("final_schedules")\
            .where("academicYear", "==", academic_year)\
            .where("semester", "==", semester)\
            .where("finalized", "==", True)\
            .stream()

        for d in other_docs:
            if d.id != final_name:
                d.reference.update({"finalized": False})

    # Key the doc by name -- matches schedule.py's save/load/delete
    # convention, all of which do db.collection("final_schedules").document(name).
    # Keying by a random uuid instead (as before) meant a master-finalized
    # schedule's document id never matched the name the frontend looked it
    # up by, so GET /schedule/final/{name} 404'd for these schedules.
    final_ref = db.collection("final_schedules").document(final_name)
    existing_final = final_ref.get()
    existing_final_data = existing_final.to_dict() if existing_final.exists else {}

    # Read events before writing metadata so eventCount is accurate --
    # list_saved()/getSchedules() rely on this field.
    events_data = _get_master_events(master_doc.reference)

    final_ref.set({
        "schedule_name": final_name,
        "semester": semester,
        "academicYear": academic_year,
        "finalized": True,
        "eventCount": len(events_data),
        "createdAt": existing_final_data.get("createdAt", now),
        "lastModified": now,
        "savedAt": now,
        "createdBy": user.get("uid"),
        "source": "queue",
        "events": events_data,
    })

    # Clean up any old subcollection that might exist from legacy publishes
    _delete_subcollection(final_ref.collection("events"))

    db.collection("coordinator_queues").document(queue_id).update({
        "status": "completed",
        "updatedAt": now
    })

    event_cache.invalidate(f"master:{master_id}")
    event_cache.invalidate(f"final:{final_name}")

    return {"message": "Master schedule finalized"}

@router.post("/master/{queue_id}/unfinalize")
def unfinalize_master_schedule(queue_id: str, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        raise HTTPException(status_code=404, detail="Master schedule not found")
    master_doc = docs[0]
    master_data = master_doc.to_dict()
    
    semester = master_data.get("semester")
    academic_year = master_data.get("academicYear")
    
    if not semester or not academic_year:
        raise HTTPException(status_code=400, detail="Missing semester/academicYear")

    now = (datetime.utcnow().isoformat() + "Z")
    
    # 1. Mark final schedule as not finalized (if it exists)
    if semester and academic_year:
        final_name = f"A.Y. {academic_year}, {semester}".strip()
    else:
        final_name = f"{semester} {academic_year} - Final".strip()
    final_ref = db.collection("final_schedules").document(final_name)
    if final_ref.get().exists:
        final_ref.update({"finalized": False})
    
    # 2. Re-open the queue and reset program statuses
    queue_ref = db.collection("coordinator_queues").document(queue_id)
    queue_doc = queue_ref.get()
    if queue_doc.exists:
        queue_data = queue_doc.to_dict()
        program_status = queue_data.get("programStatus", {})
        original_queue = queue_data.get("queue", [])
        
        for prog in program_status.keys():
            if program_status[prog] != "generating":
                program_status[prog] = "waiting"
                
        current_turn_index = -1
        for i, prog in enumerate(original_queue):
            if program_status.get(prog) == "waiting":
                program_status[prog] = "active"
                current_turn_index = i
                break
                
        queue_ref.update({
            "status": "active",
            "currentTurnIndex": current_turn_index,
            "programStatus": program_status,
            "updatedAt": now
        })
    
    # 3. Mark master_schedules as draft
    master_doc.reference.update({
        "status": "draft",
        "updatedAt": now
    })
    
    # 4. Unapprove coordinator schedules and add note
    schedules = db.collection("coordinator_schedules") \
        .where("academicYear", "==", academic_year) \
        .where("semester", "==", semester) \
        .where("status", "in", ["submitted", "approved"]) \
        .stream()
    
    batch = db.batch()
    count = 0
    for s in schedules:
        batch.update(s.reference, {
            "status": "draft",
            "approvedAt": None,
            "approvedBy": None,
            "submittedAt": None,
            "unfinalizedNote": f"The master schedule for {semester} {academic_year} was unpublished. You may need to review and resubmit.",
            "updatedAt": now
        })
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()

    # The master's event data didn't change, but the final schedule's
    # finalized flag flipped — invalidate both so nothing reads stale.
    event_cache.invalidate(f"master:{master_doc.id}")
    event_cache.invalidate(f"final:{final_name}")
        
    return {"message": "Master schedule unpublished"}

def _generate_schedule_diff(old_schedule: list, new_schedule: list) -> str:
    def get_id(ev):
        return ev.get("schedule_id") or f"{ev.get('courseCode', ev.get('course', ''))}-{ev.get('block', ev.get('section', ''))}-{ev.get('session', '')}-{ev.get('day', '')}"
    
    def format_name(ev):
        code = ev.get('courseCode', ev.get('course', '?'))
        session = str(ev.get('session', '')).upper() or "CLASS"
            
        prog = ev.get('program', '')
        year = ev.get('year', '')
        block = ev.get('block', ev.get('section', '?'))
        
        prog_block = f"{prog} {year}{block}".strip() if prog else block
        # clean up multiple spaces
        prog_block = " ".join(prog_block.split())
        
        return f"{code} {session} ({prog_block})".strip().upper()

    old_dict = {get_id(ev): ev for ev in old_schedule}
    new_dict = {get_id(ev): ev for ev in new_schedule}
    
    changes = []
    
    for uid, new_ev in new_dict.items():
        name = format_name(new_ev)
        if uid not in old_dict:
            changes.append(f"Added {name}")
        else:
            old_ev = old_dict[uid]
            modifications = []
            
            old_time = f"{old_ev.get('day', '?')} {old_ev.get('startTime', '?')}-{old_ev.get('endTime', '?')}"
            new_time = f"{new_ev.get('day', '?')} {new_ev.get('startTime', '?')}-{new_ev.get('endTime', '?')}"
            if old_time != new_time:
                modifications.append(f"time to {new_time}")
                
            if old_ev.get("room") != new_ev.get("room"):
                modifications.append(f"room to {new_ev.get('room', 'TBA')}")
                
            if old_ev.get("faculty") != new_ev.get("faculty"):
                modifications.append(f"faculty to {new_ev.get('faculty', 'TBA')}")
                
            if modifications:
                changes.append(f"Changed {name} " + " and ".join(modifications))
                
    for uid, old_ev in old_dict.items():
        if uid not in new_dict:
            name = format_name(old_ev)
            changes.append(f"Removed {name}")
            
    if not changes:
        return "Edited schedule (no class changes)"
        
    details = " | ".join(changes)
    return details[:797] + "..." if len(details) > 800 else details

@router.put("/schedule/{schedule_id}/edit")
def edit_schedule(schedule_id: str, req: EditScheduleRequest, user: dict = Depends(admin_only)):
    schedule_data = _get_schedule_or_404(schedule_id)
    program_code = schedule_data.get("programCode")
    queue_id = schedule_data.get("queueId")

    old_schedule = schedule_data.get("schedule", [])
    new_schedule = req.schedule
    
    diff_details = _generate_schedule_diff(old_schedule, new_schedule)

    now = (datetime.utcnow().isoformat() + "Z")
    db.collection("coordinator_schedules").document(schedule_id).update({
        "schedule": req.schedule,
        "updatedAt": now
    })

    if schedule_data.get("status") == "approved":
        if queue_id:
            docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
            if docs:
                master_doc = docs[0]
                events_ref = master_doc.reference.collection("events")
                _replace_program_events(events_ref, program_code, req.schedule)
                master_doc.reference.update({"updatedAt": now})
                event_cache.invalidate(f"master:{master_doc.id}")
                
    if queue_id and program_code:
        log_audit_event(queue_id, "SCHEDULE_EDITED", user, target_program=program_code, details=diff_details)

    return {"message": "Schedule updated successfully"}