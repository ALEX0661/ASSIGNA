from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from app.core.auth import admin_only, any_authenticated
from app.core.firebase import db
from app.core.globals import schedule_dict, progress_state
from app.core.scheduler import generate_schedule
import uuid

router = APIRouter()

@router.get("/generate")
def trigger_solve(background_tasks: BackgroundTasks, semester: str = None, user=Depends(admin_only)):
    process_id = str(uuid.uuid4())
    progress_state[process_id] = 0
    background_tasks.add_task(generate_schedule, process_id, semester)
    return {"process_id": process_id, "status": "started"}

@router.get("/status/{process_id}")
def get_status(process_id: str, user=Depends(admin_only)):
    prog = progress_state.get(process_id, 0)
    if prog == -1:
        return {"status": "failed", "progress": 0}
    if prog == 100:
        # Values() used here is fine for len()
        return {"status": "complete", "progress": 100, "event_count": len(schedule_dict.values())}
    return {"status": "in_progress", "progress": prog}

@router.get("/result")
def get_result(user=Depends(admin_only)):
    # FIXED: Wrapped in list() to prevent FastAPI serialization errors
    return {"schedule": list(schedule_dict.values()), "count": len(schedule_dict)}

@router.post("/save")
def save_schedule(data: dict, user=Depends(admin_only)):
    name = data.get("schedule_name", "unnamed")
    db.collection("final_schedules").document(name).set({
        "schedule_name": name,
        "schedule": list(schedule_dict.values()),
    })
    return {"saved": name}

@router.get("/final")
def list_saved(user=Depends(any_authenticated)):
    docs = db.collection("final_schedules").stream()
    return [d.id for d in docs]

@router.get("/final/{name}")
def load_saved(name: str, user=Depends(any_authenticated)):
    doc = db.collection("final_schedules").document(name).get()
    if not doc.exists:
        raise HTTPException(404, "Schedule not found")
    data = doc.to_dict()
    
    schedule_dict.clear()
    raw_list = data.get("schedule", [])
    # Re-hydrates dictionary with IDs as keys for the engine
    schedule_dict.update({str(ev.get('schedule_id')): ev for ev in raw_list})
    
    return data

@router.delete("/final/{name}")
def delete_saved(name: str, user=Depends(admin_only)):
    db.collection("final_schedules").document(name).delete()
    return {"deleted": name}