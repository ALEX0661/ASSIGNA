import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any

from app.core.auth import admin_only
from app.core.firebase import db
from app.core.globals import schedule_dict

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

    next_index = -1
    for i in range(current_index + 1, len(queue_list)):
        if program_status.get(queue_list[i]) == "waiting":
            next_index = i
            break

    now = datetime.utcnow().isoformat()
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
        "createdAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat(),
        "finalizedAt": None
    }
    db.collection("master_schedules").document(master_id).set(master_data)
    return master_id, master_data


def _replace_program_events(events_ref, program_code: str, events: list):
    """Delete a program's existing events from a subcollection, then write
    the new ones. Batched at 450 ops to stay under Firestore's 500 limit."""
    batch = db.batch()
    count = 0

    existing = events_ref.where("programCode", "==", program_code).stream()
    for doc in existing:
        batch.delete(doc.reference)
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0

    for ev in events:
        ev["programCode"] = program_code
        ev_id = str(ev.get("schedule_id") or uuid.uuid4())
        batch.set(events_ref.document(ev_id), ev)
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0

    if count:
        batch.commit()


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


def _get_master_events(master_ref):
    return [d.to_dict() for d in master_ref.collection("events").stream()]


@router.get("/submitted")
def get_submitted_schedules(user: dict = Depends(admin_only)):
    # Was hardcoded to status == "submitted", so an approved schedule
    # dropped out of this list the instant it was approved — the admin
    # dashboard's "Approved" section, activity feed, and approved-count
    # tile all read from this one endpoint, so all of them silently went
    # empty. "in" pulls both statuses; the frontend still splits them
    # into pending/approved buckets itself.
    #
    # Scoped to the currently-active queue's term. An "approved" schedule's
    # status never reverts, so without this filter the query scanned every
    # schedule ever approved across every past semester — cost that only
    # grows over time, on a dashboard polled every 20-45s. The admin only
    # ever needs this term's submissions/approvals here; past terms are
    # available through the finalized master schedule, not this endpoint.
    query = db.collection("coordinator_schedules").where("status", "in", ["submitted", "approved"])
    active_queues = db.collection("coordinator_queues").where("status", "==", "active").limit(1).get()
    if active_queues:
        active = active_queues[0].to_dict()
        semester, academic_year = active.get("semester"), active.get("academicYear")
        if semester and academic_year:
            query = query.where("semester", "==", semester).where("academicYear", "==", academic_year)
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
            "eventCount": len(data.get("schedule", []))
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

    now = datetime.utcnow().isoformat()
    db.collection("coordinator_schedules").document(schedule_id).update({
        "status": "approved",
        "approvedAt": now,
        "approvedBy": user.get("uid")
    })

    queue_id = schedule_data.get("queueId")
    if not queue_id:
        raise HTTPException(status_code=400, detail="Schedule has no queueId")

    queue_doc = db.collection("coordinator_queues").document(queue_id).get()
    if not queue_doc.exists:
        raise HTTPException(status_code=404, detail="Queue not found")

    queue_data = queue_doc.to_dict()
    program_status = queue_data.get("programStatus", {})
    program_code = schedule_data.get("programCode")

    # Mark this program as approved
    program_status[program_code] = "approved"
    queue_data["programStatus"] = program_status

    # Advance to next waiting coordinator
    updates = _advance_queue(queue_data, queue_id)

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
        "updatedAt": datetime.utcnow().isoformat()
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
                "updatedAt": datetime.utcnow().isoformat()
            })

    return {"message": "Schedule rejected"}

@router.get("/master/{queue_id}")
def get_master_schedule(queue_id: str, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        return {}
    master_doc = docs[0]
    data = master_doc.to_dict()
    data["schedule"] = _get_master_events(master_doc.reference)
    return data

@router.post("/master/{queue_id}/finalize")
def finalize_master_schedule(queue_id: str, user: dict = Depends(admin_only)):
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        raise HTTPException(status_code=404, detail="Master schedule not found")

    master_doc = docs[0]
    master_id = master_doc.id
    master_data = master_doc.to_dict()

    now = datetime.utcnow().isoformat()
    db.collection("master_schedules").document(master_id).update({
        "status": "finalized",
        "finalizedAt": now,
        "updatedAt": now
    })

    final_name = f"{master_data.get('semester', '')} {master_data.get('academicYear', '')} - Final".strip()

    semester = master_data.get("semester")
    academic_year = master_data.get("academicYear")

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
    events = [d.to_dict() for d in master_doc.reference.collection("events").stream()]

    final_ref.set({
        "schedule_name": final_name,
        "semester": semester,
        "academicYear": academic_year,
        "finalized": True,
        "eventCount": len(events),
        "createdAt": existing_final_data.get("createdAt", now),
        "lastModified": now,
        "savedAt": now,
        "createdBy": user.get("uid"),
    })

    # Copy master's events subcollection into final_schedules/{final_name}/events
    # instead of writing one giant "schedule" array field. Clear any prior
    # copy first (re-finalizing the same queue should fully replace it, not
    # merge with stale event docs from an earlier finalize).
    events_ref = final_ref.collection("events")
    _delete_subcollection(events_ref)
    batch = db.batch()
    count = 0
    for ev in events:
        ev_id = str(ev.get("schedule_id") or uuid.uuid4())
        batch.set(events_ref.document(ev_id), ev)
        count += 1
        if count >= 450:
            batch.commit()
            batch = db.batch()
            count = 0
    if count:
        batch.commit()

    db.collection("coordinator_queues").document(queue_id).update({
        "status": "completed",
        "updatedAt": now
    })

    return {"message": "Master schedule finalized"}

@router.put("/schedule/{schedule_id}/edit")
def edit_schedule(schedule_id: str, req: EditScheduleRequest, user: dict = Depends(admin_only)):
    schedule_data = _get_schedule_or_404(schedule_id)

    now = datetime.utcnow().isoformat()
    db.collection("coordinator_schedules").document(schedule_id).update({
        "schedule": req.schedule,
        "updatedAt": now
    })

    if schedule_data.get("status") == "approved":
        queue_id = schedule_data.get("queueId")
        if queue_id:
            docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
            if docs:
                master_doc = docs[0]
                program_code = schedule_data.get("programCode")
                events_ref = master_doc.reference.collection("events")

                _replace_program_events(events_ref, program_code, req.schedule)

                master_doc.reference.update({"updatedAt": now})

    return {"message": "Schedule updated successfully"}