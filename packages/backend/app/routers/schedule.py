from fastapi import APIRouter, Depends, BackgroundTasks
from app.core.auth import admin_only
from app.core.firebase import db
from app.core.globals import schedule_dict, progress_state
from app.core.scheduler import generate_schedule
import uuid

router = APIRouter()

@router.get("/generate")
def trigger_solve(background_tasks: BackgroundTasks, user=Depends(admin_only)):
    process_id = str(uuid.uuid4())
    progress_state[process_id] = 0
    background_tasks.add_task(generate_schedule, process_id)
    return {"process_id": process_id, "status": "started"}

@router.get("/status/{process_id}")
def get_status(process_id: str, user=Depends(admin_only)):
    prog = progress_state.get(process_id, 0)
    if prog == -1:
        return {"status": "failed", "progress": 0}
    if prog == 100:
        return {"status": "complete", "progress": 100}
    return {"status": "in_progress", "progress": prog}

@router.get("/result")
def get_result(user=Depends(admin_only)):
    return {"schedule": schedule_dict, "count": len(schedule_dict)}

@router.post("/save")
def save_schedule(data: dict, user=Depends(admin_only)):
    name = data.get("schedule_name", "unnamed")
    db.collection("final_schedules").document(name).set({
        "schedule_name": name,
        "schedule": schedule_dict[:]
    })
    return {"saved": name}

@router.get("/final")
def list_saved(user=Depends(admin_only)):
    docs = db.collection("final_schedules").stream()
    return [d.id for d in docs]

@router.get("/final/{name}")
def load_saved(name: str):
    doc = db.collection("final_schedules").document(name).get()
    if not doc.exists:
        from fastapi import HTTPException
        raise HTTPException(404, "Not found")
    data = doc.to_dict()
    schedule_dict.clear()
    schedule_dict.extend(data.get("schedule", []))
    return data