import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from google.cloud import firestore

from app.core.auth import admin_only
from app.core.firebase import db

router = APIRouter()

class CreateQueueRequest(BaseModel):
    semester: str
    academicYear: str
    queue: List[str]

class ReorderRequest(BaseModel):
    queue: List[str]

def _get_queue_or_404(queue_id: str):
    doc_ref = db.collection("coordinator_queues").document(queue_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Queue not found")
    return doc_ref, doc.to_dict()

def _advance_to_next(queue_data: dict):
    queue = queue_data.get("queue", [])
    program_status = queue_data.get("programStatus", {})
    current_index = queue_data.get("currentTurnIndex", 0)
    
    next_index = -1
    for i in range(current_index + 1, len(queue)):
        if program_status.get(queue[i]) == "waiting":
            next_index = i
            break
            
    if next_index != -1:
        program_status[queue[next_index]] = "active"
        queue_data["currentTurnIndex"] = next_index
    else:
        queue_data["status"] = "completed"
        
    return queue_data

@router.post("/create")
def create_queue(req: CreateQueueRequest, user: dict = Depends(admin_only)):
    active_queues = db.collection("coordinator_queues").where(filter=firestore.FieldFilter("status", "==", "active")).limit(1).get()
    if active_queues:
        raise HTTPException(status_code=400, detail="An active queue already exists")
        
    queue_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    program_status = {}
    for i, prog in enumerate(req.queue):
        program_status[prog] = "active" if i == 0 else "waiting"
        
    queue_data = {
        "queueId": queue_id,
        "semester": req.semester,
        "academicYear": req.academicYear,
        "queue": req.queue,
        "currentTurnIndex": 0 if req.queue else -1,
        "programStatus": program_status,
        "status": "active" if req.queue else "completed",
        "createdBy": user.get("uid", ""),
        "createdAt": now,
        "updatedAt": now
    }
    
    db.collection("coordinator_queues").document(queue_id).set(queue_data)
    return queue_data

@router.get("/list")
def list_queues(user: dict = Depends(admin_only)):
    docs = db.collection("coordinator_queues").order_by("createdAt", direction=firestore.Query.DESCENDING).get()
    return [doc.to_dict() for doc in docs]

@router.get("/{queue_id}")
def get_queue(queue_id: str, user: dict = Depends(admin_only)):
    _, queue_data = _get_queue_or_404(queue_id)
    return queue_data

@router.patch("/{queue_id}/reorder")
def reorder_queue(queue_id: str, req: ReorderRequest, user: dict = Depends(admin_only)):
    doc_ref, queue_data = _get_queue_or_404(queue_id)
    
    if queue_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Cannot reorder a completed queue")
        
    original_queue = queue_data.get("queue", [])
    program_status = queue_data.get("programStatus", {})
    
    waiting_programs_in_req = [p for p in req.queue if p in program_status and program_status[p] == "waiting"]
    all_waiting_programs = [p for p in original_queue if program_status.get(p) == "waiting"]
    
    for p in all_waiting_programs:
        if p not in waiting_programs_in_req:
            waiting_programs_in_req.append(p)
            
    new_queue = []
    waiting_idx = 0
    for p in original_queue:
        if program_status.get(p) != "waiting":
            new_queue.append(p)
        else:
            new_queue.append(waiting_programs_in_req[waiting_idx])
            waiting_idx += 1
            
    current_index = queue_data.get("currentTurnIndex", -1)
    active_program = original_queue[current_index] if 0 <= current_index < len(original_queue) else None
    
    if active_program and active_program in new_queue:
        queue_data["currentTurnIndex"] = new_queue.index(active_program)
        
    queue_data["queue"] = new_queue
    queue_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    doc_ref.set(queue_data)
    return queue_data

@router.post("/{queue_id}/skip/{program}")
def skip_program(queue_id: str, program: str, user: dict = Depends(admin_only)):
    doc_ref, queue_data = _get_queue_or_404(queue_id)
    
    if queue_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Queue is not active")
        
    program_status = queue_data.get("programStatus", {})
    if program not in program_status:
        raise HTTPException(status_code=404, detail="Program not found in queue")
        
    current_status = program_status[program]
    # Same override-vs-review-backlog issue as /advance: this would let
    # you skip a program that already submitted (discarding a pending
    # review) or is mid-generate (orphaning a running solve), since the
    # frontend hiding the Skip button for those states doesn't stop a
    # direct call here.
    if current_status == "submitted":
        raise HTTPException(status_code=400, detail=f"{program} has a schedule awaiting your review — approve or reject it instead of skipping them")
    if current_status == "generating":
        raise HTTPException(status_code=400, detail=f"{program} is still generating a schedule — wait for it to finish (or cancel it) before skipping")
    if current_status == "approved":
        raise HTTPException(status_code=400, detail=f"{program} has already been approved")

    program_status[program] = "skipped"
    
    current_idx = queue_data.get("currentTurnIndex", -1)
    active_program = queue_data.get("queue", [])[current_idx] if 0 <= current_idx < len(queue_data.get("queue", [])) else None
    
    if program == active_program or current_status == "active":
        queue_data = _advance_to_next(queue_data)
        
    queue_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    doc_ref.set(queue_data)
    return queue_data

@router.post("/{queue_id}/advance")
def advance_queue(queue_id: str, user: dict = Depends(admin_only)):
    doc_ref, queue_data = _get_queue_or_404(queue_id)
    
    if queue_data.get("status") != "active":
        raise HTTPException(status_code=400, detail="Queue is already completed")
        
    current_idx = queue_data.get("currentTurnIndex", 0)
    queue = queue_data.get("queue", [])
    program_status = queue_data.get("programStatus", {})
    
    if 0 <= current_idx < len(queue):
        active_prog = queue[current_idx]
        active_status = program_status.get(active_prog)
        # "Advance Queue" is a manual override for a stuck/unresponsive
        # coordinator, not a way to clear a review backlog. It used to
        # accept "generating" and "submitted" too, so clicking it while
        # someone's solve was mid-run or their schedule was sitting in
        # your review queue would force-mark them "skipped" — discarding
        # a submission you hadn't reviewed yet, or orphaning a solve that
        # was still running. Submitted schedules should move the queue
        # forward via approve/reject (approval.py already advances the
        # queue on approval); a running solve should be left to finish
        # or cancelled explicitly instead of being skipped out from under it.
        if active_status in ("active", "waiting"):
            program_status[active_prog] = "skipped"
        elif active_status == "submitted":
            raise HTTPException(status_code=400, detail=f"{active_prog} has a schedule awaiting your review — approve or reject it instead of advancing past it")
        elif active_status == "generating":
            raise HTTPException(status_code=400, detail=f"{active_prog} is still generating a schedule — wait for it to finish (or cancel it) before advancing")
            
    queue_data = _advance_to_next(queue_data)
    queue_data["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    doc_ref.set(queue_data)
    return queue_data

@router.delete("/{queue_id}")
def delete_queue(queue_id: str, user: dict = Depends(admin_only)):
    doc_ref, _ = _get_queue_or_404(queue_id)
    doc_ref.delete()
    return {"message": "Queue deleted successfully"}