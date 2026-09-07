import hashlib
import json
import re
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException, Query
from pydantic import BaseModel
from google.cloud import firestore

from app.core.coordinator_auth import coordinator_only
from app.core.auth import admin_only
from app.core.firebase import db, get_courses, get_rooms, get_time, get_days
from app.core.globals import schedule_dict, progress_state, running_processes, cancel_flags, failure_details
from app.core.scheduler import generate_coordinator_schedule, validate_phase_order, DEFAULT_PHASE_ORDER
from app.core.coordinator_auth import coordinator_only

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
        "updatedAt": datetime.utcnow().isoformat()
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
            "academicYear": data.get("academicYear"), # Add this line
            "semester": data.get("semester")          # Add this line
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
    now = datetime.utcnow().isoformat()

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
def save_schedule_inplace(schedule_id: str, user: dict = Depends(coordinator_only)):
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

    current_events  = list(schedule_dict.values())
    existing_events = data.get("schedule", [])

    current_fp  = _event_fingerprint(current_events)
    existing_fp = _event_fingerprint(existing_events) if existing_events else None
    events_changed = existing_fp is None or current_fp != existing_fp

    existing_version = data.get("version", 1)
    version_history   = list(data.get("versionHistory", []))

    already_archived = existing_fp is not None and any(
        v.get("fingerprint") == existing_fp for v in version_history
    )

    now = datetime.utcnow().isoformat()

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

    now = datetime.utcnow().isoformat()

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
        "updatedAt": datetime.utcnow().isoformat()
    })
    return {"message": "Schedule renamed successfully"}

@router.post("/schedule/{schedule_id}/duplicate")
def duplicate_schedule(schedule_id: str, req: DuplicateRequest, user: dict = Depends(coordinator_only)):
    program = user.get("coordinatorProgram")
    _, data = _verify_schedule_ownership(schedule_id, program)
    
    new_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    
    new_data = data.copy()
    new_data["name"] = req.name
    new_data["status"] = "draft"
    new_data["createdAt"] = now
    new_data["updatedAt"] = now
    
    new_data.pop("submittedAt", None)
    
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

    # Block submission if another schedule for the same term is already submitted/approved
    ay = data.get("academicYear")
    sem = data.get("semester")
    if ay and sem:
        existing = db.collection("coordinator_schedules") \
            .where("programCode", "==", program) \
            .where("academicYear", "==", ay) \
            .where("semester", "==", sem) \
            .where("status", "in", ["submitted", "approved"]) \
            .get()
        if len(existing) > 0:
            raise HTTPException(status_code=400, detail=f"A schedule for {sem} {ay} is already submitted or approved.")
    doc_ref.update({
        "status": "submitted",
        "submittedAt": datetime.utcnow().isoformat(),
        "updatedAt": datetime.utcnow().isoformat()
    })
    _set_program_status(data.get("queueId"), program, "submitted")
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
        "updatedAt": datetime.utcnow().isoformat()
    })
    _set_program_status(data.get("queueId"), program, "active", only_if="submitted")
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
        "updatedAt": datetime.utcnow().isoformat()
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
    events = [d.to_dict() for d in master_doc.reference.collection("events").stream()] if include_events else []
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