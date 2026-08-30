from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from app.core.auth import admin_only, any_authenticated
from app.core.firebase import db
from app.core.globals import schedule_dict, progress_state, running_processes, cancel_flags, failure_details, phase_state
from app.core.scheduler import generate_schedule, validate_phase_order, DEFAULT_PHASE_ORDER
import uuid
import hashlib
import json
from datetime import datetime

router = APIRouter()

# Fields that matter for "did the schedule actually change". Shared by
# /save and /restore so both can dedupe by real content instead of by
# the `version` number, which stays frozen across restores (a restore
# is a preview and intentionally doesn't bump it).
_FINGERPRINT_FIELDS = ("schedule_id", "room", "faculty", "day", "period",
                       "courseCode", "block", "session", "year", "program")

def _event_fingerprint(events):
    """Sort-stable hash of every event's mutable fields."""
    rows = sorted(
        [{k: e.get(k) for k in _FINGERPRINT_FIELDS} for e in events],
        key=lambda r: str(r.get("schedule_id", ""))
    )
    return hashlib.md5(json.dumps(rows, sort_keys=True).encode()).hexdigest()


# --- Firestore layout ---------------------------------------------------
# final_schedules/{name}                     -> metadata only (no "schedule"
#                                                field, no embedded history
#                                                snapshots)
# final_schedules/{name}/events/{event_id}   -> current LIVE schedule events
# final_schedules/{name}/versions/{version}  -> one full snapshot's events,
#                                                doc id = str(version number)
#
# This keeps every document small and bounded regardless of how many
# versions accumulate, avoiding the 1 MiB Firestore document size limit.

def _write_events(events_ref, events):
    """Replace the contents of an events subcollection with `events`,
    batched at 450 ops to stay under Firestore's 500-per-batch limit."""
    batch = db.batch()
    count = 0

    for doc in events_ref.stream():
        batch.delete(doc.reference)
        count += 1
        if count >= 450:
            batch.commit()
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


def _read_events(events_ref):
    return [d.to_dict() for d in events_ref.stream()]


def _delete_subcollection(coll_ref):
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


def _write_version_snapshot(doc_ref, version: int, events: list):
    """Store one full version snapshot as its own document, keyed by
    version number, so it never has to share space with anything else."""
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
    """Delete any stored version snapshots that fell out of the trimmed
    (last-10) versionHistory list, so subcollection storage doesn't grow
    forever."""
    for doc in doc_ref.collection("versions").stream():
        try:
            v = int(doc.id)
        except ValueError:
            continue
        if v not in keep_versions:
            doc.reference.delete()


# Fields never worth surfacing in a changelog even if their value differs —
# purely internal bookkeeping, not something a person changed on purpose.
_DIFF_IGNORED_FIELDS = {"schedule_id"}

# Preferred display order for changed fields within a modified session, so
# the most meaningful things (what/where/who/when) read first instead of
# in whatever order the dict happens to iterate. Any field not listed here
# (e.g. a newly added field on the event model) still shows — just after
# these, in alphabetical order.
_DIFF_FIELD_ORDER = ("courseCode", "block", "session", "program", "year",
                     "faculty", "room", "day", "period")


def _values_differ(a, b) -> bool:
    """String-normalized comparison so e.g. 1 vs '1' isn't reported as a
    change just because one side came through as a different type."""
    if a is None and b is None:
        return False
    return str(a) != str(b)


def _session_summary(ev: dict) -> dict:
    """Compact, display-ready view of one event for changelog rows.
    Includes every field on the event (minus internal ones) so the frontend
    always has full context to show, not just a fixed subset."""
    return {k: v for k, v in ev.items() if k not in _DIFF_IGNORED_FIELDS}


def _diff_events(before: list, after: list) -> dict:
    """Compare two full event lists (keyed by schedule_id) and return a
    human-readable added / removed / modified breakdown.

    This is what actually makes "checkpoints" into a "changelog" — the
    version snapshots already store full event lists, so a diff is just a
    matter of keying both sides and comparing fields. Every field present
    on either side of a session is compared (not a fixed whitelist) so an
    edit never silently disappears from the changelog just because the
    field it touched wasn't on some hardcoded list."""
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


@router.get("/generate")
def trigger_solve(background_tasks: BackgroundTasks, semester: str = None,
                   phase_order: str = None, user=Depends(admin_only)):
    # running_processes reflects whether a solve is *physically* executing.
    # A cancelled solve stays in this set until its loop actually notices
    # cancel_flags and exits, so this correctly blocks a restart from
    # racing against a not-yet-stopped predecessor.
    is_running = any(0 <= v < 100 for v in progress_state.values()) or bool(running_processes)
    if is_running:
        raise HTTPException(status_code=409, detail="A solve is already running. Please wait for it to stop before starting a new one.")

    # phase_order is a comma-separated list of phase names, or omitted
    # entirely — omitted means "use the tested default order" end-to-end.
    order_list = phase_order.split(",") if phase_order else None
    if order_list:
        try:
            validate_phase_order(order_list)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    process_id = str(uuid.uuid4())
    progress_state[process_id] = 0
    background_tasks.add_task(generate_schedule, process_id, semester, order_list)
    return {"process_id": process_id, "status": "started"}

@router.get("/phases")
def get_phases(user=Depends(admin_only)):
    """Read-only phase metadata so the frontend never hardcodes phase
    names/labels for the reorder UI."""
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

@router.get("/status/{process_id}")
def get_status(process_id: str, user=Depends(admin_only)):
    prog = progress_state.get(process_id, 0)
    if prog == -2:
        # Cancellation was requested (progress_state flips to -2 the instant
        # /cancel is called), but the solve loop only actually notices
        # cancel_flags — and removes itself from running_processes — between
        # CP-SAT phases, which can lag the request by a while. Reporting
        # "cancelled" here before that's happened previously let a client
        # think it was safe to start a new solve while the old one was still
        # physically running, which raced /generate's running_processes
        # check and produced a spurious 409. "stopping" tells the client to
        # keep waiting/polling instead.
        if process_id in running_processes:
            return {"status": "stopping", "progress": 0}
        return {"status": "cancelled", "progress": 0}
    if prog == -1:
        diagnostic = failure_details.pop(process_id, None)
        if diagnostic:
            return {"status": "failed", "progress": 0, "diagnostic": diagnostic}
        return {"status": "failed", "progress": 0}
    if prog == 100:
        return {"status": "complete", "progress": 100, "event_count": len(schedule_dict.values())}

    response = {"status": "in_progress", "progress": prog}
    phase_info = phase_state.get(process_id)
    if phase_info:
        response["phase"] = phase_info["phase"]
        response["totalPhases"] = phase_info["totalPhases"]
        response["phaseName"] = phase_info["phaseName"]
    return response

@router.delete("/cancel/{process_id}")
def cancel_solve(process_id: str, user=Depends(admin_only)):
    """Request cancellation of a running solve. Sets progress_state so the
    poller stops immediately, AND sets cancel_flags so the solve loop itself
    actually stops (checked between phases) instead of running to completion
    in the background — which used to let it race a subsequently-started
    solve and corrupt shared state."""
    cancel_flags.add(process_id)
    if process_id in progress_state:
        progress_state[process_id] = -2   # -2 = cancelled
    return {"cancelled": process_id}

@router.get("/diagnostic")
def get_diagnostic(semester: str = None, user=Depends(admin_only)):
    """Diagnostic endpoint to check data availability and potential issues."""
    try:
        from app.core.firebase import get_courses, get_rooms, get_time, get_days, load_all_caches

        # Refresh data
        load_all_caches()

        # Get basic data
        courses = get_courses()
        rooms = get_rooms()
        time_settings = get_time()
        days = get_days()

        # Apply semester filter
        if semester:
            filtered_courses = [c for c in courses if c.get('semester', '1st Semester') == semester]
        else:
            filtered_courses = courses

        # Calculate totals
        total_room_count = sum(len(room_list) for room_list in rooms.values()) if rooms else 0

        # Analyze potential issues
        issues = []
        if not filtered_courses:
            if semester:
                issues.append(f"No courses found for semester '{semester}' - check semester names in course data")
            else:
                issues.append("No courses loaded - check course collection in database")

        if not rooms:
            issues.append("No room categories configured - go to Settings > Rooms to configure")
        elif total_room_count == 0:
            issues.append("Room categories exist but no actual rooms listed - check room configuration")

        if not days:
            issues.append("No days configured - check day settings")

        # Course distribution by type
        course_types = {}
        for course in filtered_courses:
            code = course.get('courseCode', '').upper()
            if 'NSTP' in code:
                course_types['NSTP'] = course_types.get('NSTP', 0) + 1
            elif code.startswith('GEC') or code.startswith('MAT'):
                course_types['GEC/MAT'] = course_types.get('GEC/MAT', 0) + 1
            elif 'PE' in code or 'PATHFIT' in code:
                course_types['PE'] = course_types.get('PE', 0) + 1
            else:
                year = course.get('yearLevel', 1)
                key = f"Major Y{year}"
                course_types[key] = course_types.get(key, 0) + 1

        return {
            "status": "success",
            "summary": {
                "total_courses": len(courses),
                "filtered_courses": len(filtered_courses),
                "semester_filter": semester,
                "room_categories": len(rooms) if rooms else 0,
                "total_rooms": total_room_count,
                "days_configured": len(days) if days else 0,
                "time_settings": time_settings
            },
            "course_distribution": course_types,
            "room_details": rooms,
            "issues": issues,
            "recommendation": "No issues found - solver should work" if not issues else "Fix the issues listed above before running solver"
        }

    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "recommendation": "Check database connection and data configuration"
        }

def get_result(user=Depends(admin_only)):
    return {"schedule": list(schedule_dict.values()), "count": len(schedule_dict)}

@router.get("/result")
def get_result_endpoint(user=Depends(admin_only)):
    return {"schedule": list(schedule_dict.values()), "count": len(schedule_dict)}

@router.post("/save")
def save_schedule(data: dict, user=Depends(admin_only)):
    name = data.get("schedule_name", "unnamed")
    current_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"

    doc_ref = db.collection("final_schedules").document(name)
    existing_doc = doc_ref.get()
    existing_data = existing_doc.to_dict() if existing_doc.exists else {}

    current_events = data.get("events")
    if current_events is not None:
        # Keep schedule_dict in sync too -- the override/drag-drop engine
        # and other endpoints in this session still read from it.
        schedule_dict.clear()
        schedule_dict.update({str(ev.get("schedule_id", uuid.uuid4())): ev for ev in current_events})
    else:
        # Back-compat path: caller didn't send events explicitly (e.g. the
        # auto-save-after-drag-drop flow), fall back to whatever is
        # currently in the shared in-memory dict.
        current_events = list(schedule_dict.values())
    # Existing events now live in a subcollection, not a field on the doc.
    existing_events = _read_events(doc_ref.collection("events")) if existing_doc.exists else []

    # A brand-new schedule (nothing in Firestore yet) always counts as changed
    is_new         = not existing_data
    current_fp     = _event_fingerprint(current_events)
    existing_fp    = _event_fingerprint(existing_events) if existing_events else None
    events_changed = is_new or (current_fp != existing_fp)

    existing_version = existing_data.get("version", 1)

    # The label for whatever is CURRENTLY live, about to be overwritten by
    # this save. If the live doc is a restored preview, `restoredFromVersion`
    # is what it actually reflects -- the frozen `version` field would
    # mislabel it (same logic restore_version uses below). Without this,
    # saving on top of a restore archives the restored content under the
    # OLD version's number, producing a second, differently-shaped
    # versionHistory entry with a version number that's already taken.
    existing_label = existing_data.get("restoredFromVersion") or existing_version

    # Lightweight history entries -- no embedded event arrays. Each entry
    # carries a fingerprint so dedupe checks below never need to load a
    # full snapshot's events.
    version_history = list(existing_data.get("versionHistory", []))

    # Dedupe by content fingerprint, not by version number -- if the live
    # doc's content already exists somewhere in history (e.g. it's an
    # unedited restore), don't archive a duplicate copy of it under a
    # colliding label.
    already_archived = existing_fp is not None and any(
        v.get("fingerprint") == existing_fp for v in version_history
    )

    # Add history entry only when content changed, this isn't the first
    # ever save, and it isn't already sitting in history under another label
    if events_changed and not is_new and not already_archived:
        version_history.append({
            "version":     existing_label,
            "savedAt":     existing_data.get("savedAt", existing_data.get("createdAt", current_time)),
            "eventCount":  len(existing_events),
            "user":        user.get("email", "unknown"),
            "fingerprint": existing_fp,
        })
        # Persist the full snapshot separately so the parent doc stays small.
        _write_version_snapshot(doc_ref, existing_label, existing_events)

    # Keep last 10 restore points
    version_history = version_history[-10:]
    _prune_version_snapshots(doc_ref, {v.get("version") for v in version_history})

    # Mint a version number that has never been used before. A plain
    # `existing_version + 1` looks safe but isn't: once a restore has
    # happened, `version` stays frozen while versionHistory can already
    # contain higher-or-equal numbers (e.g. the archived pre-restore
    # snapshot), so a naive +1 can reuse a number that's already taken --
    # two different snapshots end up sharing a "version 5" label, which is
    # exactly what breaks restoring that version later.
    known_versions = [existing_version] + [v.get("version", 1) for v in version_history]
    if existing_data.get("restoredFromVersion"):
        known_versions.append(existing_data["restoredFromVersion"])
    version = (max(known_versions) + 1) if events_changed else existing_version

    doc_data = {
        "schedule_name":  name,
        "academicYear":   data.get("academic_year"),
        "semester":       data.get("semester"),
        "finalized":      data.get("finalized", existing_data.get("finalized", False)),
        "version":        version,
        "lastModified":   current_time,
        "savedAt":        current_time,
        "eventCount":     len(current_events),
        "createdAt":      existing_data.get("createdAt", current_time),
        "versionHistory": version_history,
    }

    doc_ref.set(doc_data)
    _write_events(doc_ref.collection("events"), current_events)

    return {
        "saved":        name,
        "version":      version,
        "savedAt":      current_time,
        "eventCount":   len(current_events),
        "changed":      events_changed,
    }

@router.get("/final")
def list_saved(user=Depends(any_authenticated)):
    docs = db.collection("final_schedules").stream()
    return [{
        "id": d.id,
        "name": d.to_dict().get("schedule_name", d.id),
        "academicYear": d.to_dict().get("academicYear"),
        "semester": d.to_dict().get("semester"),
        "finalized": d.to_dict().get("finalized", False),
        "createdAt": d.to_dict().get("createdAt"),
        "lastModified": d.to_dict().get("lastModified"),
        "savedAt": d.to_dict().get("savedAt"),
        "version": d.to_dict().get("version", 1),
        "eventCount": d.to_dict().get("eventCount", 0)
    } for d in docs]

@router.get("/final/active")
def get_active(academic_year: str, semester: str, user=Depends(any_authenticated)):
    docs = db.collection("final_schedules")\
        .where("academicYear", "==", academic_year)\
        .where("semester", "==", semester)\
        .where("finalized", "==", True)\
        .stream()
    for d in docs:
        data = d.to_dict()
        data["schedule"] = _read_events(d.reference.collection("events"))
        return data
    raise HTTPException(404, "Active schedule not found")

@router.get("/final/{name}")
def load_saved(name: str, user=Depends(any_authenticated)):
    doc_ref = db.collection("final_schedules").document(name)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Schedule not found")
    data = doc.to_dict()

    raw_list = _read_events(doc_ref.collection("events"))
    schedule_dict.clear()
    schedule_dict.update({str(ev.get("schedule_id")): ev for ev in raw_list})

    return {
        **data,
        "schedule": raw_list,
        # versionHistory entries no longer carry embedded events, so
        # there's nothing bulky left to strip out for the UI timeline.
        "versionHistory": data.get("versionHistory", []),
    }

@router.post("/final/{name}/finalize")
def finalize_schedule(name: str, user=Depends(admin_only)):
    doc_ref = db.collection("final_schedules").document(name)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Schedule not found")

    data = doc.to_dict()
    ay = data.get("academicYear")
    sem = data.get("semester")

    if ay and sem:
        other_docs = db.collection("final_schedules")\
            .where("academicYear", "==", ay)\
            .where("semester", "==", sem)\
            .where("finalized", "==", True)\
            .stream()

        for d in other_docs:
            if d.id != name:
                d.reference.update({"finalized": False})

    doc_ref.update({"finalized": True})
    return {"finalized": name}

@router.post("/final/{name}/unfinalize")
def unfinalize_schedule(name: str, user=Depends(admin_only)):
    doc_ref = db.collection("final_schedules").document(name)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Schedule not found")
    doc_ref.update({"finalized": False})
    return {"unfinalized": name}

@router.put("/final/{name}/metadata")
def update_metadata(name: str, data: dict, user=Depends(admin_only)):
    doc_ref = db.collection("final_schedules").document(name)
    if not doc_ref.get().exists:
        raise HTTPException(404, "Schedule not found")

    updates = {}
    if "academic_year" in data:
        updates["academicYear"] = data["academic_year"]
    if "semester" in data:
        updates["semester"] = data["semester"]

    if updates:
        doc_ref.update(updates)

    return {"updated": name}

@router.post("/final/{name}/restore/{version}")
def restore_version(name: str, version: int, user=Depends(admin_only)):
    """Restore a schedule's events to a previous saved version.

    Does NOT create a new version — the restored data becomes the
    current live state. The user can then review and save if satisfied.
    The restored events are loaded into schedule_dict so the next
    GET /final/{name} reflects them immediately.
    """
    doc_ref = db.collection("final_schedules").document(name)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Schedule not found")

    data = doc.to_dict()

    if data.get("finalized"):
        raise HTTPException(
            403,
            "Cannot restore a previous version while this schedule is finalized. "
            "Unfinalize it first."
        )

    version_history = data.get("versionHistory", [])

    # Find the target version entry
    target = next((v for v in version_history if v.get("version") == version), None)
    if not target:
        raise HTTPException(404, f"Version {version} not found in history")

    restored_events = _read_version_snapshot(doc_ref, version)
    if not restored_events:
        raise HTTPException(422, f"Version {version} has no stored schedule data and cannot be restored")

    current_time = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.%f") + "Z"

    # Archive whatever is CURRENTLY live before we clobber it. Without this,
    # restoring an old version would silently destroy the most recent save
    # (or a previous restore's preview) if it wasn't already captured in
    # history somewhere.
    #
    # NOTE: we dedupe by content fingerprint, not by the `version` number.
    # `version` is frozen across restores by design (a restore is a preview,
    # not a new save) — so after the very first restore, a `version_history`
    # entry with that version number already exists forever, and a
    # number-based check would wrongly treat every later restore's live
    # state as "already archived" and skip archiving it, silently losing it.
    current_live_events = _read_events(doc_ref.collection("events"))
    # The label for whatever's currently live. If we're already viewing a
    # restored preview, `restoredFromVersion` is what it actually reflects —
    # NOT the frozen `version` field, which never changes across restores
    # and would mislabel the archived snapshot with the wrong number.
    current_version = data.get("restoredFromVersion") or data.get("version", 1)
    current_fp = _event_fingerprint(current_live_events) if current_live_events else None
    already_archived = current_fp is not None and any(
        v.get("fingerprint") == current_fp for v in version_history
    )
    if current_live_events and not already_archived:
        version_history = version_history + [{
            "version":     current_version,
            "savedAt":     data.get("savedAt", data.get("createdAt", current_time)),
            "eventCount":  len(current_live_events),
            "user":        data.get("restoredBy") or "system",
            "fingerprint": current_fp,
        }]
        version_history = version_history[-10:]
        _write_version_snapshot(doc_ref, current_version, current_live_events)
        _prune_version_snapshots(doc_ref, {v.get("version") for v in version_history})

    # Swap schedule_dict to the restored events
    schedule_dict.clear()
    schedule_dict.update({str(ev.get("schedule_id")): ev for ev in restored_events})

    # Replace the live events subcollection with the restored events.
    _write_events(doc_ref.collection("events"), restored_events)

    # Update Firestore metadata: keep the same version number — this is a
    # preview, not a new save.
    doc_ref.update({
        "versionHistory": version_history,
        "eventCount": len(restored_events),
        "lastModified": current_time,
        # Tag it so the frontend knows it was restored (shown in the UI)
        "restoredFromVersion": version,
        "restoredAt": current_time,
        "restoredBy": user.get("email", "unknown"),
    })

    return {
        "restored": name,
        "fromVersion": version,
        "eventCount": len(restored_events),
        "restoredAt": current_time,
    }

@router.get("/final/{name}/diff/{version}")
def get_version_diff(name: str, version: int, user=Depends(any_authenticated)):
    """Changelog for a version: what actually changed compared to the
    version immediately before it. Works for an archived saved version
    (compares to its predecessor in versionHistory) and for the current
    live/unsaved version (compares to the most recently saved version).

    For the oldest recorded version there's nothing older to compare
    against, so every session in it is reported as "added" — that's the
    correct reading of "this is where history starts", not a bug.
    """
    doc_ref = db.collection("final_schedules").document(name)
    doc = doc_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Schedule not found")

    data = doc.to_dict()
    # Sort by savedAt (not version number) because `version` freezes across
    # restores and can repeat across entries — savedAt is always a real,
    # strictly-increasing timeline of what actually happened.
    version_history = sorted(
        data.get("versionHistory", []),
        key=lambda v: v.get("savedAt") or ""
    )

    target_events = _read_version_snapshot(doc_ref, version)
    if target_events is None:
        # Not archived as a snapshot yet — only valid if it's the current
        # live version (the one that hasn't been superseded by a save/restore).
        if data.get("version") == version and not data.get("restoredFromVersion"):
            target_events = _read_events(doc_ref.collection("events"))
        else:
            raise HTTPException(404, f"Version {version} has no stored schedule data")

    idx = next((i for i, v in enumerate(version_history) if v.get("version") == version), None)
    if idx is not None:
        # An archived version — compare against whatever came right before it.
        prev_version = version_history[idx - 1]["version"] if idx > 0 else None
    else:
        # Not archived — this is the live current state. Its predecessor is
        # simply the most recently saved version, if any exists yet.
        prev_version = version_history[-1]["version"] if version_history else None
    prev_events = _read_version_snapshot(doc_ref, prev_version) if prev_version is not None else []

    diff = _diff_events(prev_events, target_events)
    diff["version"] = version
    diff["comparedTo"] = prev_version
    return diff

@router.delete("/final/{name}")
def delete_saved(name: str, user=Depends(admin_only)):
    doc_ref = db.collection("final_schedules").document(name)
    _delete_subcollection(doc_ref.collection("events"))
    _delete_subcollection(doc_ref.collection("versions"))
    doc_ref.delete()
    return {"deleted": name}