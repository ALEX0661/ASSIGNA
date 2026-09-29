import hashlib
import json
import re
import uuid
from collections import defaultdict
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from google.cloud import firestore

from app.core.coordinator_auth import coordinator_only
from app.core.auth import admin_only
from app.core.firebase import db, get_courses, get_rooms, get_time, get_days, get_faculty
from app.core.globals import schedule_dict, progress_state, running_processes, cancel_flags, failure_details
from app.core.scheduler import generate_coordinator_schedule, validate_phase_order, DEFAULT_PHASE_ORDER
from app.core.event_cache import event_cache
from app.core.audit import log_audit_event
from app.core.unit_balancing import evaluate_workload
# Reuse the admin analytics helpers so coordinator numbers match the dean's.
# ADJUST THIS ONE LINE if analytics.py lives somewhere other than app/routers/.
from app.routers import analytics as _an

router = APIRouter()

class GenerateScheduleRequest(BaseModel):
    # None (the default) means "use the tested default order" end-to-end —
    # this field is entirely opt-in.
    phase_order: list[str] | None = None

class SaveScheduleRequest(BaseModel):
    name: str

class RenameRequest(BaseModel):
    name: str

class DuplicateRequest(BaseModel):
    name: str

class RoomSelectionRequest(BaseModel):
    lecture: list = []
    lab: list = []

def _get_active_queue():
    queues = db.collection("coordinator_queues").where("status", "==", "active").limit(1).get()
    if not queues:
        return None, None
    return queues[0].id, queues[0].to_dict()

def _set_program_status(queue_id: str, program: str, new_status: str, only_if: str = None):
    """Update a single program's entry in a queue's flat programStatus map
    without clobbering the rest of it. Used to keep coordinators from being
    blind to what everyone else in the queue is actually doing right now
    (waiting / active / generating / submitted), not just whose turn it is.
    If only_if is given, the write is skipped unless the program's current
    status matches it — avoids stomping a newer status with a stale one."""
    if not queue_id:
        return
    doc_ref = db.collection("coordinator_queues").document(queue_id)
    doc = doc_ref.get()
    if not doc.exists:
        return
    data = doc.to_dict()
    if only_if is not None and data.get("programStatus", {}).get(program) != only_if:
        return
    doc_ref.update({
        f"programStatus.{program}": new_status,
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    })

def _verify_schedule_ownership(schedule_id: str, program: str):
    doc_ref = db.collection("coordinator_schedules").document(schedule_id)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Schedule not found")
    data = doc.to_dict()
    if data.get("programCode") != program:
        raise HTTPException(status_code=403, detail="Not authorized to access this schedule")
    return doc_ref, data

def _require_editable(data: dict):
    """Editing (overrides, save-in-place, restore) is only allowed while a
    schedule is still a draft — once submitted it's awaiting admin review
    and shouldn't shift under them; once approved it's part of the master
    schedule."""
    if data.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft schedules can be edited")

# ── Merged-block helpers (ported from overrides.py — same rules, so a
#    coordinator's merge detection matches what the admin editor sees for
#    the same event shape) ───────────────────────────────────────────────

def _is_merged_id(schedule_id) -> bool:
    return bool(re.search(r'-[A-Z]$', str(schedule_id or '')))

def _base_merged_id(schedule_id) -> str:
    return re.sub(r'-[A-Z]$', '', str(schedule_id or ''))

def _are_merged_partners(ev_a: dict, ev_b: dict) -> bool:
    if not ev_a or not ev_b:
        return False
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
    sid_a = str(ev_a.get("schedule_id", ""))
    sid_b = str(ev_b.get("schedule_id", ""))
    if _is_merged_id(sid_a) and _is_merged_id(sid_b):
        return _base_merged_id(sid_a) == _base_merged_id(sid_b)
    return False

# ── Version-history helpers (ported from schedule.py's admin editor — same
#    fingerprint/diff logic, adapted for the coordinator doc shape: events
#    live in a flat `schedule` field on `coordinator_schedules/{id}` rather
#    than an `events` subcollection, but snapshots still get their own
#    `versions` subcollection so the parent doc stays small) ─────────────

_FINGERPRINT_FIELDS = ("schedule_id", "room", "faculty", "day", "period",
                       "courseCode", "block", "session", "year", "program")

def _event_fingerprint(events):
    """Sort-stable hash of every event's mutable fields."""
    rows = sorted(
        [{k: e.get(k) for k in _FINGERPRINT_FIELDS} for e in events],
        key=lambda r: str(r.get("schedule_id", ""))
    )
    return hashlib.md5(json.dumps(rows, sort_keys=True).encode()).hexdigest()

def _write_version_snapshot(doc_ref, version: int, events: list):
    doc_ref.collection("versions").document(str(version)).set({
        "version": version,
        "schedule": events,
    })

def _read_version_snapshot(doc_ref, version: int):
    snap = doc_ref.collection("versions").document(str(version)).get()
    if not snap.exists:
        return None
    return snap.to_dict().get("schedule")

def _prune_version_snapshots(doc_ref, keep_versions: set):
    """Delete stored snapshots that fell out of the trimmed (last-10)
    versionHistory list, so the versions subcollection doesn't grow forever."""
    for doc in doc_ref.collection("versions").stream():
        try:
            v = int(doc.id)
        except ValueError:
            continue
        if v not in keep_versions:
            doc.reference.delete()

# Fields never worth surfacing in a changelog even if their value differs.
_DIFF_IGNORED_FIELDS = {"schedule_id"}

# Preferred display order for changed fields within a modified session.
_DIFF_FIELD_ORDER = ("courseCode", "block", "session", "program", "year",
                     "faculty", "room", "day", "period")

def _values_differ(a, b) -> bool:
    if a is None and b is None:
        return False
    return str(a) != str(b)

def _session_summary(ev: dict) -> dict:
    return {k: v for k, v in ev.items() if k not in _DIFF_IGNORED_FIELDS}

def _diff_events(before: list, after: list) -> dict:
    before_map = {str(e.get("schedule_id")): e for e in (before or []) if e.get("schedule_id") is not None}
    after_map  = {str(e.get("schedule_id")): e for e in (after or [])  if e.get("schedule_id") is not None}

    added_ids   = [k for k in after_map if k not in before_map]
    removed_ids = [k for k in before_map if k not in after_map]

    def _sort_key(field):
        try:
            return (0, _DIFF_FIELD_ORDER.index(field))
        except ValueError:
            return (1, field)

    modified = []
    for k, a in after_map.items():
        b = before_map.get(k)
        if b is None:
            continue
        fields = (set(a.keys()) | set(b.keys())) - _DIFF_IGNORED_FIELDS
        changed_fields = sorted(
            (f for f in fields if _values_differ(b.get(f), a.get(f))),
            key=_sort_key
        )
        if not changed_fields:
            continue
        changes = {f: {"from": b.get(f), "to": a.get(f)} for f in changed_fields}
        modified.append({**_session_summary(a), "changes": changes})

    return {
        "added":         [_session_summary(after_map[k]) for k in added_ids],
        "removed":       [_session_summary(before_map[k]) for k in removed_ids],
        "modified":      modified,
        "addedCount":    len(added_ids),
        "removedCount":  len(removed_ids),
        "modifiedCount": len(modified),
        "unchangedCount": len(after_map) - len(added_ids) - len(modified),
    }

@router.get("/schedule/list")
def list_schedules(
    user: dict = Depends(coordinator_only),
    # Optional cap for callers that don't need the full history — the
    # coordinator dashboard's background poll passes this so it isn't
    # reading every draft/duplicate/rejected schedule this program has
    # ever created on every refresh; the full "My Schedules" page still
    # calls this with no limit, since it deliberately shows everything,
    # grouped by term, and only fetches on its own page load (not on a
    # repeating timer).
    limit: int = Query(None, ge=1, le=200),
):
    program = user.get("coordinatorProgram")
    if not program:
        raise HTTPException(status_code=400, detail="User missing coordinatorProgram")

    query = db.collection("coordinator_schedules").where("programCode", "==", program)
    if limit:
        # Note: Removing order_by to avoid needing a composite index which causes 500 errors.
        query = query.limit(limit)
        docs = query.stream()
    else:
        docs = query.stream()

    schedules = []
    for doc in docs:
        data = doc.to_dict()
        schedules.append({
            "id": doc.id,
            "name": data.get("name"),
            "status": data.get("status"),
            "programCode": data.get("programCode"),
            "createdAt": data.get("createdAt"),
            "eventCount": len(data.get("schedule", [])),
            "academicYear": data.get("academicYear"),
            "semester": data.get("semester"),
            "rejectionFeedback": data.get("rejectionFeedback"),
            "unfinalizedNote": data.get("unfinalizedNote")
        })
    return schedules

@router.get("/schedule/counts")
def get_schedule_counts(user: dict = Depends(coordinator_only)):
    """Status breakdown for the dashboard's stat card, without reading every
    schedule document. Firestore's count() aggregation is billed as a single
    read per query regardless of how many documents match, so this is 4
    reads total (one per status + total) instead of one per schedule this
    program has ever created — and that cost stays flat as history grows,
    unlike GET /schedule/list without a limit."""
    program = user.get("coordinatorProgram")
    if not program:
        raise HTTPException(status_code=400, detail="User missing coordinatorProgram")

    base = db.collection("coordinator_schedules").where("programCode", "==", program)

    def _count(query):
        return query.count().get()[0][0].value

    total = _count(base)
    drafts = _count(base.where("status", "==", "draft"))
    submitted = _count(base.where("status", "==", "submitted"))
    approved = _count(base.where("status", "==", "approved"))

    return {"total": total, "drafts": drafts, "submitted": submitted, "approved": approved}

def _is_active(v):
    # Legacy/completed states: -2 cancelled, -1 failed (int), 100 complete.
    # A dict value means a *detailed* failure payload (see scheduler.py) —
    # it's a terminal state too, not "still running", but it can't be
    # compared with 0 <= v < 100 since it isn't a number.
    if isinstance(v, dict):
        return False
    return 0 <= v < 100

@router.post("/schedule/generate")
def generate(background_tasks: BackgroundTasks,
             req: GenerateScheduleRequest = GenerateScheduleRequest(),
             user: dict = Depends(coordinator_only)):
    is_running = any(_is_active(v) for v in progress_state.values()) or bool(running_processes)
    if is_running:
        raise HTTPException(status_code=409, detail="Solver is already running")

    if req.phase_order:
        try:
            validate_phase_order(req.phase_order)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
    program = user.get("coordinatorProgram")
    
    queue_id, queue_doc = _get_active_queue()
    if not queue_id:
        raise HTTPException(status_code=400, detail="No active queue found")

    semester = queue_doc.get("semester")
    academic_year = queue_doc.get("academicYear")
    if not semester:
        raise HTTPException(status_code=400, detail="Active queue has no semester configured. Contact the admin.")

    current_index = queue_doc.get("currentTurnIndex", 0)
    queue = queue_doc.get("queue", [])
    
    if not queue:
        raise HTTPException(status_code=400, detail="Active queue is empty")
        
    if current_index >= len(queue):
        raise HTTPException(status_code=400, detail="Queue index out of bounds")
        
    current_program = queue[current_index]
    if current_program != program:
        raise HTTPException(status_code=403, detail=f"Not your turn. It is currently {current_program}'s turn.")

    # So the rest of the queue can see you're actually running the solver
    # right now, not just sitting on your turn.
    _set_program_status(queue_id, program, "generating")

    pre_booked_events = []
    approved_docs = db.collection("coordinator_schedules") \
        .where("queueId", "==", queue_id) \
        .where("status", "==", "approved") \
        .stream()
    for doc in approved_docs:
        data = doc.to_dict()
        pre_booked_events.extend(data.get("schedule", []))

    selected_rooms = None
    room_doc = db.collection("coordinator_room_selections").document(program).get()
    if room_doc.exists:
        selected_rooms = room_doc.to_dict()
        selected_rooms.pop("updatedAt", None)

    process_id = str(uuid.uuid4())
    progress_state[process_id] = 0  
    background_tasks.add_task(
        generate_coordinator_schedule,
        process_id, program, semester, selected_rooms, pre_booked_events, req.phase_order
    )

    log_audit_event(queue_id, "GENERATION_STARTED", user, target_program=program, details=f"Started generating schedule")
    return {"process_id": process_id, "status": "started", "semester": semester, "academicYear": academic_year}

@router.get("/schedule/phases")
def get_coord_phases(user: dict = Depends(coordinator_only)):
    """Same payload as the admin GET /schedule/phases, gated by
    coordinator_only since coordinators can't hit the admin-only route."""
    return {
        "phases": [
            {"key": "NSTP", "label": "NSTP (Fri/Sat only)"},
            {"key": "GEC_MAT", "label": "GEC & MAT (Mon–Thu pattern)"},
            {"key": "MAJORS_Y4", "label": "4th Year Majors (Practicum)"},
            {"key": "MAJORS_Y3", "label": "3rd Year Majors"},
            {"key": "MAJORS_Y2", "label": "2nd Year Majors"},
            {"key": "MAJORS_Y1", "label": "1st Year Majors"},
            {"key": "PE", "label": "PE (fills remaining gaps)"},
        ],
        "default": DEFAULT_PHASE_ORDER,
    }

@router.get("/schedule/status/{process_id}")
def schedule_status(process_id: str, user: dict = Depends(coordinator_only)):
    val = progress_state.get(process_id, None)
    program = user.get("coordinatorProgram")
    
    if val is None:
        return {"status": "not_found", "progress": 0}
        
    if val == -1:
        queue_id, _ = _get_active_queue()
        _set_program_status(queue_id, program, "active", only_if="generating")
        detail = failure_details.get(process_id)
        if detail:
            return {
                "status": "failed",
                "progress": 0,
                "failedPhase": detail.get("failed_phase"),
                "reasons": detail.get("reasons", []),
                "suggestions": detail.get("suggestions", [])
            }
        return {"status": "failed", "progress": 0, "reasons": ["Unspecified constraint failure."]}
    if val == -2:
        # Cancellation was requested (progress_state flips to -2 the instant
        # /cancel is called), but generate_coordinator_schedule only notices
        # cancel_flags — and removes itself from running_processes — between
        # phases, which can lag the request. Reporting "cancelled" before that
        # actually happens lets a client think it's safe to call /generate
        # again while the old task is still physically running, which races
        # /generate's running_processes check and produces a spurious 409.
        # For the same reason, don't flip the queue status back to "active"
        # until it's truly stopped — otherwise the rest of the queue would
        # see the coordinator as idle while the solver is still crunching.
        if process_id in running_processes:
            return {"status": "stopping", "progress": 0}
        queue_id, _ = _get_active_queue()
        _set_program_status(queue_id, program, "active", only_if="generating")
        return {"status": "cancelled", "progress": 0}
    if val == 100:
        queue_id, _ = _get_active_queue()
        _set_program_status(queue_id, program, "active", only_if="generating")
        return {"status": "completed", "progress": 100}
        
    return {"status": "running", "progress": val}

@router.delete("/schedule/cancel/{process_id}")
def cancel_schedule(process_id: str, user: dict = Depends(coordinator_only)):
    cancel_flags.add(process_id)
    if process_id in progress_state:
        progress_state[process_id] = -2
    return {"cancelled": process_id}

@router.get("/schedule/result")
def schedule_result(user: dict = Depends(coordinator_only)):
    return {"schedule": list(schedule_dict.values())}

@router.post("/schedule/save")
def save_schedule(req: SaveScheduleRequest, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    uid = user.get("uid")
    
    schedule_id = str(uuid.uuid4())
    now = (datetime.utcnow().isoformat() + "Z")

    queue_id, queue_doc = _get_active_queue()
    semester = queue_doc.get("semester") if queue_doc else None
    academic_year = queue_doc.get("academicYear") if queue_doc else None

    doc_data = {
        "scheduleId": schedule_id,
        "queueId": queue_id,
        "name": req.name,
        "status": "draft",
        "programCode": program,
        "coordinatorId": uid,
        "semester": semester,
        "academicYear": academic_year,
        "schedule": list(schedule_dict.values()),
        "selectedRooms": {},
        "version": 1,
        "versionHistory": [],
        "createdAt": now,
        "updatedAt": now,
        "submittedAt": None,
        "approvedAt": None,
        "approvedBy": None
    }
    
    room_doc = db.collection("coordinator_room_selections").document(program).get()
    if room_doc.exists:
        doc_data["selectedRooms"] = room_doc.to_dict()
    
    db.collection("coordinator_schedules").document(schedule_id).set(doc_data)
    
    return {"message": "Schedule saved successfully", "id": schedule_id}

@router.get("/schedule/{schedule_id}")
def get_schedule(schedule_id: str, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    _, data = _verify_schedule_ownership(schedule_id, program)
    
    schedule_dict.clear()
    for event in data.get("schedule", []):
        schedule_dict[str(event.get("schedule_id", uuid.uuid4()))] = event
        
    return data

@router.put("/schedule/{schedule_id}")
def save_schedule_inplace(schedule_id: str, payload: dict, user: dict = Depends(coordinator_only)):
    """Save-in-place for the editor: persists the current in-memory
    schedule_dict (populated by GET /schedule/{schedule_id}) back onto the
    SAME doc — unlike POST /schedule/save which always mints a new draft —
    and, same as the admin editor, archives the previous state as a new
    version whenever the content actually changed.

    Note: schedule_dict is a process-wide shared buffer (same one the admin
    editor and every other coordinator's session read/write). It's loaded
    fresh by GET /schedule/{schedule_id} right before editing starts, same
    convention the rest of this file already uses — but two coordinators
    (or a coordinator and an admin) editing at the same moment can still
    clobber each other's in-memory buffer. Fine for now since each program
    only has one active coordinator, but worth a per-session store later.
    """
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    _require_editable(data)

    current_events = payload.get("events") if payload and payload.get("events") else list(schedule_dict.values())
    if payload and payload.get("events"):
        schedule_dict.clear()
        for ev in payload.get("events"):
            schedule_dict[str(ev.get("schedule_id", uuid.uuid4()))] = ev
    existing_events = data.get("schedule", [])

    current_fp  = _event_fingerprint(current_events)
    existing_fp = _event_fingerprint(existing_events) if existing_events else None
    events_changed = existing_fp is None or current_fp != existing_fp

    existing_version = data.get("version", 1)
    version_history   = list(data.get("versionHistory", []))

    already_archived = existing_fp is not None and any(
        v.get("fingerprint") == existing_fp for v in version_history
    )

    now = (datetime.utcnow().isoformat() + "Z")

    # Archive the state being overwritten — only when it actually differs
    # from what's about to replace it, and isn't already sitting in history.
    if events_changed and existing_events and not already_archived:
        version_history.append({
            "version":     existing_version,
            "savedAt":     data.get("updatedAt", data.get("createdAt", now)),
            "eventCount":  len(existing_events),
            "user":        user.get("email", "unknown"),
            "fingerprint": existing_fp,
        })
        _write_version_snapshot(doc_ref, existing_version, existing_events)

    version_history = version_history[-10:]
    _prune_version_snapshots(doc_ref, {v.get("version") for v in version_history})

    known_versions = [existing_version] + [v.get("version", 1) for v in version_history]
    version = (max(known_versions) + 1) if events_changed else existing_version

    doc_ref.update({
        "schedule":       current_events,
        "version":        version,
        "versionHistory": version_history,
        "updatedAt":      now,
    })
    return {
        "message":    "Schedule saved",
        "id":         schedule_id,
        "eventCount": len(current_events),
        "version":    version,
        "savedAt":    now,
        "changed":    events_changed,
    }

@router.post("/schedule/{schedule_id}/override")
def override_session(schedule_id: str, body: dict, user: dict = Depends(coordinator_only)):
    """Coordinator-scoped twin of POST /overrides/session — same conflict
    and merge-partner rules (and the same request shape: courseCode/block/
    session as a fallback lookup when schedule_id isn't given, matching
    what svHooks.js's useDragDrop and SessionModal.jsx actually send), but
    authorized against the coordinator's own draft schedule instead of
    admin_only. `force_override` is accepted but — same as the admin
    route — not currently acted on."""
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    _require_editable(data)

    sid = body.get("schedule_id")
    target = schedule_dict.get(str(sid))
    if not target:
        for ev in schedule_dict.values():
            if (ev.get("courseCode") == body.get("courseCode")
                    and ev.get("block") == body.get("block")
                    and ev.get("session") == body.get("session")):
                target = ev
                break
    if target is None:
        raise HTTPException(404, "Session not found in current schedule")

    new_room   = body.get("new_room")
    new_day    = body.get("new_day")
    new_period = body.get("new_period")

    if new_room and new_day and new_period:
        if new_room.lower() not in ("online", "tba"):
            for ev in schedule_dict.values():
                if ev is target:
                    continue
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

    if new_day:
        target["day"] = new_day
    if new_period:
        target["period"] = new_period
        parts = new_period.split(" - ")
        if len(parts) == 2:
            target["startTime"], target["endTime"] = parts[0], parts[1]
    if new_room:
        target["room"] = new_room

    new_faculty = body.get("new_faculty")
    if new_faculty:
        target["faculty"] = new_faculty
        target["facultyAutoAssigned"] = False
        target["assignmentScore"] = None

    return {"overridden": True, "event": target}

@router.post("/schedule/{schedule_id}/restore/{version}")
def restore_schedule_version(schedule_id: str, version: int, user: dict = Depends(coordinator_only)):
    """Restore this schedule's events to a previous saved version. Does NOT
    create a new version — the restored data becomes the current live
    state (loaded into schedule_dict too), same as the admin editor's
    restore. The coordinator reviews and hits Save if they want to keep it."""
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    _require_editable(data)

    version_history = data.get("versionHistory", [])
    target = next((v for v in version_history if v.get("version") == version), None)
    if not target:
        raise HTTPException(404, f"Version {version} not found in history")

    restored_events = _read_version_snapshot(doc_ref, version)
    if not restored_events:
        raise HTTPException(422, f"Version {version} has no stored schedule data and cannot be restored")

    now = (datetime.utcnow().isoformat() + "Z")

    # Archive whatever is currently live before clobbering it, deduped by
    # content fingerprint (not version number, which freezes across restores).
    current_live_events = data.get("schedule", [])
    current_version = data.get("restoredFromVersion") or data.get("version", 1)
    current_fp = _event_fingerprint(current_live_events) if current_live_events else None
    already_archived = current_fp is not None and any(
        v.get("fingerprint") == current_fp for v in version_history
    )
    if current_live_events and not already_archived:
        version_history = version_history + [{
            "version":     current_version,
            "savedAt":     data.get("updatedAt", data.get("createdAt", now)),
            "eventCount":  len(current_live_events),
            "user":        data.get("restoredBy") or "system",
            "fingerprint": current_fp,
        }]
        version_history = version_history[-10:]
        _write_version_snapshot(doc_ref, current_version, current_live_events)
        _prune_version_snapshots(doc_ref, {v.get("version") for v in version_history})

    schedule_dict.clear()
    schedule_dict.update({str(ev.get("schedule_id", uuid.uuid4())): ev for ev in restored_events})

    doc_ref.update({
        "schedule":            restored_events,
        "versionHistory":      version_history,
        "updatedAt":           now,
        "restoredFromVersion": version,
        "restoredAt":          now,
        "restoredBy":          user.get("email", "unknown"),
    })

    return {
        "restored":    schedule_id,
        "fromVersion": version,
        "eventCount":  len(restored_events),
        "restoredAt":  now,
    }

@router.get("/schedule/{schedule_id}/diff/{version}")
def get_schedule_version_diff(schedule_id: str, version: int, user: dict = Depends(coordinator_only)):
    """Changelog for a version: what changed compared to the version right
    before it. Read-only — allowed regardless of draft/submitted/approved
    status, same as the admin editor's diff endpoint."""
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)

    version_history = sorted(
        data.get("versionHistory", []),
        key=lambda v: v.get("savedAt") or ""
    )

    target_events = _read_version_snapshot(doc_ref, version)
    if target_events is None:
        if data.get("version") == version and not data.get("restoredFromVersion"):
            target_events = data.get("schedule", [])
        else:
            raise HTTPException(404, f"Version {version} has no stored schedule data")

    idx = next((i for i, v in enumerate(version_history) if v.get("version") == version), None)
    if idx is not None:
        prev_version = version_history[idx - 1]["version"] if idx > 0 else None
    else:
        prev_version = version_history[-1]["version"] if version_history else None
    prev_events = _read_version_snapshot(doc_ref, prev_version) if prev_version is not None else []

    diff = _diff_events(prev_events, target_events)
    diff["version"] = version
    diff["comparedTo"] = prev_version
    return diff

@router.delete("/schedule/{schedule_id}")
def delete_schedule(schedule_id: str, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    
    if data.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft schedules can be deleted")
        
    doc_ref.delete()
    return {"message": "Schedule deleted successfully"}

@router.patch("/schedule/{schedule_id}/rename")
def rename_schedule(schedule_id: str, req: RenameRequest, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    
    doc_ref.update({
        "name": req.name,
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    })
    return {"message": "Schedule renamed successfully"}

@router.post("/schedule/{schedule_id}/duplicate")
def duplicate_schedule(schedule_id: str, req: DuplicateRequest, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    _, data = _verify_schedule_ownership(schedule_id, program)
    
    new_id = str(uuid.uuid4())
    now = (datetime.utcnow().isoformat() + "Z")
    
    new_data = data.copy()
    new_data["name"] = req.name
    new_data["status"] = "draft"
    new_data["scheduleId"] = new_id  # was left pointing at the original doc
    new_data["createdAt"] = now
    new_data["updatedAt"] = now
    
    new_data.pop("submittedAt", None)
    new_data.pop("approvedAt", None)
    new_data.pop("approvedBy", None)
    
    db.collection("coordinator_schedules").document(new_id).set(new_data)
    
    return {"message": "Schedule duplicated successfully", "id": new_id}

def _term_conflict(program: str, academic_year, semester, exclude_id: str):
    """A program may only have one submitted-or-approved schedule per
    academic term. Returns the conflicting schedule's dict, or None."""
    if not academic_year or not semester:
        return None
    docs = db.collection("coordinator_schedules") \
        .where("programCode", "==", program) \
        .where("academicYear", "==", academic_year) \
        .where("semester", "==", semester) \
        .where("status", "in", ["submitted", "approved"]) \
        .stream()
    for doc in docs:
        if doc.id != exclude_id:
            return doc.to_dict()
    return None

@router.post("/schedule/{schedule_id}/submit")
def submit_schedule(schedule_id: str, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    
    if data.get("status") != "draft":
        raise HTTPException(status_code=400, detail="Only draft schedules can be submitted")

    queue_id, queue_doc = _get_active_queue()
    if not queue_id:
        raise HTTPException(status_code=400, detail="There is no active scheduling queue.")
        
    q_sem = queue_doc.get("semester")
    q_ay = queue_doc.get("academicYear")
    if data.get("semester") != q_sem or data.get("academicYear") != q_ay:
        raise HTTPException(status_code=400, detail="Schedule term does not match the active queue.")

    # Block submission if it isn't this program's turn yet — this was
    # computed for the /queue/my-turn dashboard readout but never actually
    # enforced here, so any coordinator could submit out of turn as long as
    # their draft was in the active term.
    queue_list = queue_doc.get("queue", [])
    current_index = queue_doc.get("currentTurnIndex", -1)
    current_program = queue_list[current_index] if 0 <= current_index < len(queue_list) else None
    if current_program != program:
        raise HTTPException(status_code=400, detail="It's not your turn to submit yet.")

    # Block submission if another schedule for the same term is already submitted/approved
    if queue_id:
        existing = db.collection("coordinator_schedules") \
            .where("programCode", "==", program) \
            .where("queueId", "==", queue_id) \
            .where("status", "in", ["submitted", "approved"]) \
            .get()
        if len(existing) > 0:
            raise HTTPException(status_code=400, detail=f"You already have a submitted or approved schedule in the active queue.")
    doc_ref.update({
        "status": "submitted",
        "submittedAt": (datetime.utcnow().isoformat() + "Z"),
        "updatedAt": (datetime.utcnow().isoformat() + "Z"),
        "queueId": queue_id,
        "rejectionFeedback": firestore.DELETE_FIELD,
        "unfinalizedNote": firestore.DELETE_FIELD
    })
    _set_program_status(queue_id, program, "submitted")
    log_audit_event(queue_id, "SCHEDULE_SUBMITTED", user, target_program=program, details=f"Submitted schedule for review")
    return {"message": "Schedule submitted successfully"}

@router.post("/schedule/{schedule_id}/unsubmit")
def unsubmit_schedule(schedule_id: str, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc_ref, data = _verify_schedule_ownership(schedule_id, program)
    
    if data.get("status") != "submitted":
        raise HTTPException(status_code=400, detail="Only submitted schedules can be unsubmitted")
        
    doc_ref.update({
        "status": "draft",
        "submittedAt": None,
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    })
    _set_program_status(data.get("queueId"), program, "active", only_if="submitted")
    log_audit_event(data.get("queueId"), "SCHEDULE_WITHDRAWN", user, target_program=program, details=f"Withdrew submission")
    return {"message": "Schedule unsubmitted successfully"}

@router.get("/rooms")
def get_global_rooms(user: dict = Depends(coordinator_only)):
    return get_rooms()

@router.post("/rooms/select")
def save_room_selection(req: RoomSelectionRequest, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc_data = {
        "lecture": req.lecture,
        "lab": req.lab,
        "updatedAt": (datetime.utcnow().isoformat() + "Z")
    }
    db.collection("coordinator_room_selections").document(program).set(doc_data)
    return {"message": "Room selection saved successfully"}

@router.get("/rooms/selected")
def get_selected_rooms(user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    doc = db.collection("coordinator_room_selections").document(program).get()
    if doc.exists:
        return doc.to_dict()
    return {"lecture": [], "lab": []}

@router.get("/courses")
def get_coordinator_courses(user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    all_courses = get_courses()
    filtered = [c for c in all_courses if c.get('program') == program]
    # DEBUG: print it to the terminal too
    print(f"DEBUG: program={program}, all_courses_len={len(all_courses)}, filtered_len={len(filtered)}")
    # We must return a list because the frontend expects an array.
    return filtered

@router.get("/faculty")
def get_coordinator_faculty(include_archived: bool = False, user: dict = Depends(coordinator_only)):
    """Full faculty roster for the coordinator's schedule view / session picker.

    GET /faculty/ is scoped to the caller's own record for non-admins, which left
    the picker with a single name. The roster is served from the same in-memory
    cache the admin route uses (0 Firestore reads). SexAtBirth is not needed for
    scheduling, so it is not sent to coordinators.
    """
    roster = list(get_faculty())
    if not include_archived:
        roster = [f for f in roster if not f.get("archived", False)]
    return [{k: v for k, v in f.items() if k != "SexAtBirth"} for f in roster]

@router.get("/queue/my-turn")
def check_queue_turn(user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    
    queue_id, data = _get_active_queue()
    if not queue_id:
        return {
            "isMyTurn": False,
            "currentProgram": None,
            "myPosition": -1,
            "queueLength": 0,
            "queueId": None,
            "semester": None,
            "academicYear": None,
        }

    queue = data.get("queue", [])
    program_status = data.get("programStatus", {})
    current_index = data.get("currentTurnIndex", 0)
    
    current_program = queue[current_index] if 0 <= current_index < len(queue) else None
    is_my_turn = (current_program == program)
    # queue.index() is 0-based; the dashboard displays this value directly as
    # "Position X of Y", so it must be 1-based to match reality (a program
    # placed last in a queue of 4 was showing as "3 of 4" instead of "4 of 4").
    my_position = (queue.index(program) + 1) if program in queue else -1

    # The dashboard and scheduler pages both render a per-program status rail
    # (waiting / active / generating / submitted / approved / skipped), but
    # this endpoint was never actually sending the queue or its statuses —
    # only counts. That rail was rendering empty, so no one could see what
    # anyone else in the queue was doing. Send it as {program, status} pairs
    # so the frontend doesn't have to (and can't incorrectly) infer status
    # from position alone.
    queue_with_status = [
        {"program": p, "status": program_status.get(p, "waiting")} for p in queue
    ]

    return {
        "isMyTurn": is_my_turn,
        "currentProgram": current_program,
        "myPosition": my_position,
        "queueLength": len(queue),
        "queueId": queue_id,
        "semester": data.get("semester"),
        "academicYear": data.get("academicYear"),
        "queue": queue_with_status,
    }

@router.get("/queue/submitted-schedule")
def get_submitted_master_schedule(
    user: dict = Depends(coordinator_only),
    include_events: bool = Query(
        False,
        description="Fetch the actual scheduled sessions from the master schedule's "
                    "events subcollection. Costs one Firestore read per event in the "
                    "master schedule, so only pass this when the caller actually needs "
                    "the sessions (e.g. running a room/faculty conflict check) — not for "
                    "a dashboard that only shows the approved-programs count.",
    ),
):
    # BUGFIX: this used to read `data.get("schedule", [])` off the master
    # doc's top-level fields, which always returned [] — approval.py moved
    # master-schedule events into an `events` subcollection (to stay under
    # Firestore's 1 MiB document size limit) and only ever writes metadata
    # (approvedPrograms, semester, etc.) onto the parent doc itself. So the
    # scheduler page's room/faculty conflict checks against the master board
    # were silently running against an empty list the whole time.
    queues = db.collection("coordinator_queues").where("status", "==", "active").limit(1).get()
    if not queues:
        return {"schedule": [], "approvedPrograms": []}

    queue_id = queues[0].id
    docs = db.collection("master_schedules").where("queueId", "==", queue_id).get()
    if not docs:
        return {"schedule": [], "approvedPrograms": []}

    master_doc = docs[0]
    data = master_doc.to_dict()
    events = []
    if include_events:
        cache_key = f"master:{master_doc.id}"
        events = event_cache.get(cache_key)
        if events is None:
            events = [d.to_dict() for d in master_doc.reference.collection("events").stream()]
            event_cache.put(cache_key, events)

    return {
        "schedule": events,
        "approvedPrograms": data.get("approvedPrograms", []),
        "semester": data.get("semester"),
        "academicYear": data.get("academicYear"),
    }

@router.get("/settings")
def get_global_settings(user: dict = Depends(coordinator_only)):
    return {
        "rooms": get_rooms(),
        "time": get_time(),
        "days": get_days()
    }


# ══════════════════════════════════════════════════════════════════════════════
#  Coordinator analytics
#
#  Everything below is scoped to the caller's own program and is computed from
#  the schedule DOCUMENT in Firestore (coordinator_schedules/{id}), never from
#  the shared in-memory schedule_dict. That buffer is process-wide and gets
#  overwritten by any other coordinator's generate / open-in-editor, so reading
#  it here would show one coordinator another program's data.
#
#  Approved schedules from OTHER programs in the same queue are pulled in as
#  read-only "external" events. That is what lets us tell a coordinator about
#  clashes and faculty overloads that only exist because of what other programs
#  already locked in — the one thing they cannot see from their own draft.
#
#  Metric definitions are reused from the admin analytics module so the numbers
#  match what the dean sees for the same events.
# ══════════════════════════════════════════════════════════════════════════════

_DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
_NO_ROOM_NAMES = {"", "tba", "online", "virtual", "online/virtual"}
_LONG_GAP_MIN = 90        # an in-day gap at least this long counts as a "long gap"
_NEAR_CAP_PCT = 85


def _ev_slot(e: dict) -> str:
    return str(e.get("period") or e.get("timeSlot") or e.get("time") or "").strip()


def _brief(e: dict, external: bool) -> dict:
    return {
        "courseCode": e.get("courseCode"),
        "block":      e.get("block"),
        "year":       e.get("year"),
        "session":    e.get("session"),
        "room":       e.get("room"),
        "faculty":    e.get("faculty"),
        "program":    e.get("program"),
        "external":   external,
    }


def _external_approved_events(queue_id, program: str):
    """Events of every APPROVED schedule in this queue that belongs to another
    program. Returns (events, [program codes])."""
    if not queue_id:
        return [], []
    events, programs = [], []
    docs = db.collection("coordinator_schedules") \
        .where("queueId", "==", queue_id) \
        .where("status", "==", "approved") \
        .stream()
    for doc in docs:
        d = doc.to_dict()
        if d.get("programCode") == program:
            continue
        events.extend(d.get("schedule", []) or [])
        if d.get("programCode"):
            programs.append(d.get("programCode"))
    return events, sorted(set(programs))


def _coord_conflicts(mine: list, external: list) -> dict:
    """Room / faculty / section overlaps.

    'internal' = both sessions are in this schedule.
    'cross'    = one session is this schedule's, the other belongs to an
                 already-approved program (the approved one is what wins, so
                 the fix is always on this coordinator's side).
    Two external sessions clashing with each other is not this coordinator's
    problem and is ignored."""
    tagged = [(e, False) for e in mine] + [(e, True) for e in external]
    buckets = {"room": defaultdict(list), "faculty": defaultdict(list), "section": defaultdict(list)}

    for idx, (e, _) in enumerate(tagged):
        day = (e.get("day") or "").strip()
        if not day:
            continue
        room = (e.get("room") or "").strip()
        fac = (e.get("faculty") or "").strip()
        prog, year, block = e.get("program"), str(e.get("year", "")), e.get("block")
        if room and room.lower() not in _NO_ROOM_NAMES:
            buckets["room"][(day, room.lower())].append(idx)
        if fac and fac.upper() != "TBA":
            buckets["faculty"][(day, fac.lower())].append(idx)
        if prog and year and block:
            buckets["section"][(day, prog, year, block)].append(idx)

    found: dict = {}
    for kind, groups in buckets.items():
        for idxs in groups.values():
            for x in range(len(idxs)):
                for y in range(x + 1, len(idxs)):
                    i, j = idxs[x], idxs[y]
                    (ea, xa), (eb, xb) = tagged[i], tagged[j]
                    if xa and xb:
                        continue
                    if _an._are_merge_partners(ea, eb):
                        continue
                    sa, sb = _ev_slot(ea), _ev_slot(eb)
                    pa, pb = _an._parse_slot(sa), _an._parse_slot(sb)
                    clash = _an._slots_overlap(pa, pb) if (pa is not None and pb is not None) \
                        else (bool(sa) and sa == sb)
                    if clash:
                        found.setdefault((i, j), set()).add(kind)

    internal_ids, cross_ids, items = set(), set(), []
    for (i, j), kinds in found.items():
        (ea, xa), (eb, xb) = tagged[i], tagged[j]
        scope = "cross" if (xa or xb) else "internal"
        for idx, is_ext in ((i, xa), (j, xb)):
            if not is_ext:
                (cross_ids if scope == "cross" else internal_ids).add(idx)
        items.append({
            "scope":  scope,
            "kinds":  sorted(kinds),
            "day":    (ea.get("day") or "").strip(),
            "period": _ev_slot(ea),
            "a":      _brief(ea, xa),
            "b":      _brief(eb, xb),
        })

    def _day_i(d):
        return _DAY_ORDER.index(d) if d in _DAY_ORDER else 99

    items.sort(key=lambda p: (p["scope"] != "internal", _day_i(p["day"]), p["period"]))
    return {
        "internal":   len(internal_ids),
        "cross":      len(cross_ids),
        "totalPairs": len(items),
        "items":      items[:25],
    }


def _section_stats(events: list) -> list:
    """What each student section actually experiences: contact hours, days on
    campus, longest day, and dead time between classes."""
    secs: dict = {}
    for e in events:
        year = str(e.get("year", "") or "")
        block = str(e.get("block", "") or "")
        s = secs.setdefault((year, block), {"sessions": 0, "days": defaultdict(list)})
        s["sessions"] += 1
        day = (e.get("day") or "").strip()
        rng = _an._event_minutes(e)
        if day and rng:
            s["days"][day].append(rng)

    def _sort_key(k):
        try:
            return (int(k[0]), k[1])
        except ValueError:
            return (99, k[1])

    rows = []
    for (year, block), s in sorted(secs.items(), key=lambda kv: _sort_key(kv[0])):
        total_min, max_day, long_gaps, gap_min = 0, 0, 0, 0
        for ranges in s["days"].values():
            ranges.sort()
            day_min = sum(b - a for a, b in ranges)
            total_min += day_min
            max_day = max(max_day, day_min)
            reach = ranges[0][1]
            for a, b in ranges[1:]:
                gap = a - reach
                if gap > 0:
                    gap_min += gap
                    if gap >= _LONG_GAP_MIN:
                        long_gaps += 1
                reach = max(reach, b)
        rows.append({
            "section":     f"{year}-{block}" if year and block else (year or block or "—"),
            "year":        year,
            "block":       block,
            "sessions":    s["sessions"],
            "hours":       round(total_min / 60, 1),
            "days":        len(s["days"]),
            "maxDayHours": round(max_day / 60, 1),
            "longGaps":    long_gaps,
            "gapHours":    round(gap_min / 60, 1),
        })
    return rows


def _room_rows(events: list, selected_rooms: dict, window_hours: float) -> dict:
    """Hours booked per room. Rooms the coordinator selected but never used
    are included at zero so idle rooms are visible."""
    def _names(v):
        out = []
        for r in (v or []):
            n = r if isinstance(r, str) else (r.get("name") if isinstance(r, dict) else None)
            if n:
                out.append(str(n).strip())
        return out

    kind = {}
    for n in _names((selected_rooms or {}).get("lecture")):
        kind[n.lower()] = ("lecture", n)
    for n in _names((selected_rooms or {}).get("lab")):
        kind[n.lower()] = ("lab", n)

    booked: dict = {}
    seen = set()
    for e in events:
        room = (e.get("room") or "").strip()
        if room.lower() in _NO_ROOM_NAMES:
            continue
        rng = _an._event_minutes(e)
        key = (e.get("day"), _ev_slot(e), room.lower(), e.get("courseCode"), e.get("faculty"))
        if key in seen:               # merged sections = one physical class
            continue
        seen.add(key)
        b = booked.setdefault(room.lower(), {"room": room, "sessions": 0, "minutes": 0})
        b["sessions"] += 1
        if rng:
            b["minutes"] += rng[1] - rng[0]

    for low, (_, name) in kind.items():
        booked.setdefault(low, {"room": name, "sessions": 0, "minutes": 0})

    rows = []
    for low, b in booked.items():
        hours = b["minutes"] / 60
        rows.append({
            "room":         b["room"],
            "type":         kind.get(low, (None,))[0],
            "sessions":     b["sessions"],
            "hours":        round(hours, 1),
            "occupancyPct": round(hours / window_hours * 100, 1) if window_hours else 0,
        })
    rows.sort(key=lambda r: (-r["hours"], r["room"]))
    return {
        "rows":        rows[:16],
        "idle":        sum(1 for r in rows if r["sessions"] == 0),
        "windowHours": round(window_hours, 1),
        "hasSelection": bool(kind),
    }


def _hour_heatmap(events: list) -> list:
    heat: dict = defaultdict(int)
    seen = set()
    for e in events:
        day = (e.get("day") or "").strip()
        rng = _an._event_minutes(e)
        if not day or not rng:
            continue
        key = (day, _ev_slot(e), e.get("room"), e.get("courseCode"), e.get("faculty"))
        if key in seen:
            continue
        seen.add(key)
        h = rng[0] // 60
        while h * 60 < rng[1] and h < 24:
            heat[(day, h)] += 1
            h += 1
    return [{"day": d, "hour": h, "count": c} for (d, h), c in sorted(heat.items())]


def _faculty_ledger(events: list, external: list, faculty_list: list, courses: list):
    """One row per instructor teaching this schedule: how loaded they are
    (this program vs. what other approved programs already gave them, against
    their cap) and how well the schedule fits their specialization/preferences."""
    sat = _an._satisfaction_analysis(events, faculty_list, courses)

    mine_d = {f"m{i}": e for i, e in enumerate(events)}
    all_d = dict(mine_d)
    all_d.update({f"x{i}": e for i, e in enumerate(external)})
    wl_mine = {r["name"]: r for r in evaluate_workload(faculty_list, mine_d)}
    wl_all = {r["name"]: r for r in evaluate_workload(faculty_list, all_d)}

    rows = []
    for r in sat["rows"]:
        name = r["name"]
        m, a = wl_mine.get(name), wl_all.get(name)
        cap = (a or m or {}).get("effective_max")
        mine_u = round(float((m or {}).get("assigned", 0) or 0), 1)
        total_u = round(float((a or {}).get("assigned", mine_u) or 0), 1)
        pct = round(total_u / cap * 100, 1) if cap else None
        overloaded = bool((a or {}).get("overloaded", False))
        rows.append({
            "name":           name,
            "status":         r["status"],
            "sessions":       r["sessions"],
            "courses":        r["courses"],
            "satisfaction":   r["satisfaction"],
            "band":           r["band"],
            "specScore":      r["specScore"],
            "dayScore":       r["dayScore"],
            "timeScore":      r["timeScore"],
            "mineUnits":      mine_u,
            "elsewhereUnits": round(max(total_u - mine_u, 0), 1),
            "totalUnits":     total_u,
            "cap":            cap,
            "loadPct":        pct,
            "overloaded":     overloaded,
            "nearCap":        (not overloaded) and pct is not None and pct >= _NEAR_CAP_PCT,
        })
    return rows, sat["summary"]


def _readiness(conflicts: dict, has_external: bool, tba_n: int, fac_rows: list,
               sat_summary: dict, room_summary: dict, n_events: int) -> dict:
    if n_events == 0:
        return {"verdict": "empty", "headline": "This schedule has no sessions yet.", "items": []}

    overloaded = sum(1 for r in fac_rows if r["overloaded"])
    near = sum(1 for r in fac_rows if r["nearCap"])
    poor = (sat_summary.get("bands") or {}).get("poor", 0)
    items = []

    n = conflicts["internal"]
    items.append({
        "id": "conflicts", "label": "Conflicts inside this schedule", "count": n,
        "status": "fail" if n else "pass",
        "detail": (f"{n} session{'s' if n != 1 else ''} share a room, instructor or section at the same time."
                   if n else "No room, instructor or section double-bookings."),
    })

    n = conflicts["cross"]
    if has_external:
        items.append({
            "id": "cross", "label": "Clashes with approved programs", "count": n,
            "status": "fail" if n else "pass",
            "detail": (f"{n} of your sessions collide with a room or instructor already locked in by another program. Yours has to move."
                       if n else "Nothing collides with programs that are already approved."),
        })
    else:
        items.append({
            "id": "cross", "label": "Clashes with approved programs", "count": 0, "status": "info",
            "detail": "No other program has been approved in this queue yet, so there is nothing to check against.",
        })

    items.append({
        "id": "tba", "label": "Sessions without an instructor", "count": tba_n,
        "status": "warn" if tba_n else "pass",
        "detail": (f"{tba_n} major-course session{'s' if tba_n != 1 else ''} still TBA."
                   if tba_n else "Every major-course session has an instructor."),
    })

    items.append({
        "id": "load", "label": "Instructor unit caps", "count": overloaded + near,
        "status": "fail" if overloaded else "warn" if near else "pass",
        "detail": (f"{overloaded} over cap (counting units from other approved programs)."
                   if overloaded else
                   f"{near} at {_NEAR_CAP_PCT}% or more of their cap." if near else
                   "Everyone is under their cap."),
    })

    rs = room_summary or {}
    if rs.get("sessionsWithPref"):
        v = rs.get("violatedSessions", 0)
        items.append({
            "id": "rooms", "label": "Assigned rooms respected", "count": v,
            "status": "warn" if v else "pass",
            "detail": (f"{v} of {rs['sessionsWithPref']} sessions with a preferred room landed somewhere else."
                       if v else "Every session with a preferred room is in it."),
        })

    items.append({
        "id": "fit", "label": "Instructor fit", "count": poor,
        "status": "warn" if poor else "pass",
        "detail": (f"{poor} instructor{'s' if poor != 1 else ''} score below 40 on specialization and preferences."
                   if poor else "No instructor is badly matched."),
    })

    fails = sum(1 for i in items if i["status"] == "fail")
    warns = sum(1 for i in items if i["status"] == "warn")
    if fails:
        verdict, headline = "not_ready", f"{fails} issue{'s' if fails != 1 else ''} to fix before you submit."
    elif warns:
        verdict, headline = "review", f"No blockers, but {warns} thing{'s' if warns != 1 else ''} worth a look."
    else:
        verdict, headline = "ready", "Ready to submit."
    return {"verdict": verdict, "headline": headline, "items": items}


def _analyze_schedule(events: list, external: list, program: str, semester, selected_rooms: dict) -> dict:
    active_faculty = [f for f in get_faculty() if not f.get("archived", False)]
    prog_courses = [c for c in get_courses() if c.get("program") == program]
    term_courses = [c for c in prog_courses
                    if not semester or c.get("semester", "1st Semester") == semester]

    major = [e for e in events if not _an._is_other_dept(e.get("courseCode", ""))]
    tba_events = [e for e in major if (e.get("faculty") or "TBA") == "TBA"]

    conflicts = _coord_conflicts(events, external)
    fac_rows, sat_summary = _faculty_ledger(events, external, active_faculty, prog_courses)
    room_comp = _an._room_compliance_analysis(events, prog_courses, get_rooms())

    try:
        t = get_time() or {}
        start_t, end_t = int(t.get("start_time", 7)), int(t.get("end_time", 21))
    except Exception:
        start_t, end_t = 7, 21
    n_days = len(get_days() or []) or 6
    window_hours = max(end_t - start_t, 1) * n_days

    day_map: dict = defaultdict(int)
    for e in events:
        d = (e.get("day") or "").strip()
        if d:
            day_map[d] += 1
    by_day = [{"day": d, "sessions": day_map[d]} for d in _DAY_ORDER if d in day_map]
    by_day += [{"day": d, "sessions": c} for d, c in day_map.items() if d not in _DAY_ORDER]

    tba_map: dict = {}
    for e in tba_events:
        code = (e.get("courseCode") or "").strip() or "Unknown"
        r = tba_map.setdefault(code, {
            "courseCode": code, "sessions": 0, "blocks": set(),
            "title": e.get("courseTitle") or e.get("title") or "",
        })
        r["sessions"] += 1
        if e.get("block"):
            r["blocks"].add(str(e.get("block")))
    tba_courses = sorted(
        [{**r, "blocks": sorted(r["blocks"])} for r in tba_map.values()],
        key=lambda r: (-r["sessions"], r["courseCode"]),
    )[:10]

    staffing = [
        {"courseCode": r["courseCode"], "title": r["title"], "facultyCount": r["facultyCount"]}
        for r in _an._compute_specialization_coverage(term_courses, active_faculty)
        if r["facultyCount"] <= 1
    ][:10]

    sections = _section_stats(events)
    rooms = _room_rows(events, selected_rooms or {}, window_hours)
    rc = room_comp["summary"]
    rooms["compliance"] = {
        "respectPct":      rc["respectPct"],
        "sessionsWithPref": rc["sessionsWithPref"],
        "violated":        rc["violatedSessions"],
        "rows": [
            {k: r[k] for k in ("courseCode", "title", "preferredLec", "preferredLab",
                                "rooms", "violated", "sessions", "status")}
            for r in room_comp["rows"] if r["status"] != "respected"
        ][:6],
    }

    readiness = _readiness(conflicts, bool(external), len(tba_events), fac_rows,
                           sat_summary, rc, len(events))

    typ = {"lecture": 0, "lab": 0}
    for e in events:
        typ["lab" if "lab" in (e.get("session") or "").lower() else "lecture"] += 1

    return {
        "summary": {
            "sessions":        len(events),
            "majorSessions":   len(major),
            "tbaSessions":     len(tba_events),
            "coveragePct":     round((len(major) - len(tba_events)) / len(major) * 100, 1) if major else 0,
            "sections":        len(sections),
            "faculty":         len(fac_rows),
            "lectureSessions": typ["lecture"],
            "labSessions":     typ["lab"],
            "conflicts":       conflicts["internal"],
            "crossConflicts":  conflicts["cross"],
            "overloaded":      sum(1 for r in fac_rows if r["overloaded"]),
            "nearCap":         sum(1 for r in fac_rows if r["nearCap"]),
            "avgSatisfaction": sat_summary.get("avgSatisfaction"),
            "poorFit":         (sat_summary.get("bands") or {}).get("poor", 0),
            "roomRespectPct":  rc["respectPct"],
        },
        "readiness":     readiness,
        "conflicts":     conflicts,
        "faculty":       fac_rows,
        "byDay":         by_day,
        "heatmap":       _hour_heatmap(events),
        "sections":      sections,
        "rooms":         rooms,
        "tbaCourses":    tba_courses,
        "staffingRisks": staffing,
    }


@router.get("/analytics/schedule/{schedule_id}")
def coordinator_schedule_analytics(schedule_id: str, user: dict = Depends(coordinator_only)):
    """Full analytics for ONE of this coordinator's own schedules (draft,
    submitted or approved). Read-only; does not touch schedule_dict."""
    program = user.get("coordinatorProgram")
    _, data = _verify_schedule_ownership(schedule_id, program)
    events = data.get("schedule", []) or []
    external, ext_programs = _external_approved_events(data.get("queueId"), program)

    out = _analyze_schedule(events, external, program, data.get("semester"), data.get("selectedRooms") or {})
    out["schedule"] = {
        "id":           schedule_id,
        "name":         data.get("name"),
        "status":       data.get("status"),
        "semester":     data.get("semester"),
        "academicYear": data.get("academicYear"),
        "version":      data.get("version", 1),
        "updatedAt":    data.get("updatedAt"),
    }
    out["externalPrograms"] = ext_programs
    return out


@router.get("/analytics/overview")
def coordinator_analytics_overview(
    all_terms: bool = Query(False, description="Include schedules from every term, not just the active one"),
    limit: int = Query(10, ge=1, le=100),
    user: dict = Depends(coordinator_only),
):
    """Compact side-by-side numbers for this program's schedules so the
    coordinator can pick which draft to submit.

    Default: schedules in the active term only (newest 10) -- what the
    Analytics page uses. With all_terms=true it also covers past terms; the
    My Schedules page uses that to show per-card health for every schedule.
    Costs one document read per schedule plus one per approved schedule in the
    queue (once, shared)."""
    program = user.get("coordinatorProgram")
    if not program:
        raise HTTPException(status_code=400, detail="User missing coordinatorProgram")

    _, queue_doc = _get_active_queue()
    term = None
    if queue_doc:
        term = {"semester": queue_doc.get("semester"), "academicYear": queue_doc.get("academicYear")}

    docs = []
    for doc in db.collection("coordinator_schedules").where("programCode", "==", program).stream():
        d = doc.to_dict()
        if term and not all_terms and (d.get("semester") != term["semester"] or d.get("academicYear") != term["academicYear"]):
            continue
        docs.append((doc.id, d))
    docs.sort(key=lambda x: x[1].get("updatedAt") or x[1].get("createdAt") or "", reverse=True)
    docs = docs[:limit]

    ext_cache: dict = {}
    rows = []
    for sid, d in docs:
        qid = d.get("queueId")
        if qid not in ext_cache:
            ext_cache[qid] = _external_approved_events(qid, program)
        external, _ = ext_cache[qid]
        events = d.get("schedule", []) or []
        a = _analyze_schedule(events, external, program, d.get("semester"), d.get("selectedRooms") or {})
        s = a["summary"]
        rows.append({
            "id":              sid,
            "name":            d.get("name"),
            "status":          d.get("status"),
            "semester":        d.get("semester"),
            "academicYear":    d.get("academicYear"),
            "updatedAt":       d.get("updatedAt"),
            "createdAt":       d.get("createdAt"),
            "verdict":         a["readiness"]["verdict"],
            "sessions":        s["sessions"],
            "conflicts":       s["conflicts"],
            "crossConflicts":  s["crossConflicts"],
            "tbaSessions":     s["tbaSessions"],
            "overloaded":      s["overloaded"],
            "avgSatisfaction": s["avgSatisfaction"],
        })

    drafts = [r for r in rows if r["status"] == "draft"]
    default_id = (drafts or rows)[0]["id"] if rows else None
    return {"programCode": program, "term": term, "schedules": rows, "defaultId": default_id}