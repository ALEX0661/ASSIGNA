import uuid
from datetime import datetime, timezone
from app.core.firebase import db

def get_actor_name(user: dict) -> str:
    """Helper to extract a readable name from the user token."""
    if not user:
        return "System"
    return user.get("name") or user.get("email") or "Unknown User"

def get_actor_role_label(user: dict, target_program: str = None) -> str:
    """
    Builds a role label that includes the coordinator's program when applicable,
    e.g. 'BSIT Coordinator' instead of just 'Faculty'/'coordinator'.

    Note: accounts don't carry role == "coordinator" — every account is
    "faculty", and coordinator status is signaled purely by having a
    coordinatorProgram assigned. So program presence, not the role string,
    decides whether someone is shown as a Coordinator.
    """
    if not user:
        return "System"

    role = user.get("role", "faculty")
    program = user.get("coordinatorProgram") or target_program

    if role == "admin":
        return "Admin"
    if program:
        return f"{program} Coordinator"
    return "Faculty"

def log_audit_event(queue_id: str, action: str, user: dict, target_program: str = None, details: str = None):
    """
    Writes an audit log to the `audit_logs` subcollection of a coordinator queue.
    Using a subcollection avoids the need for composite indexes when ordering by timestamp.
    """
    if not queue_id:
        return

    doc_id = str(uuid.uuid4())
    doc_ref = db.collection("coordinator_queues").document(queue_id).collection("audit_logs").document(doc_id)

    actor_name = get_actor_name(user)
    actor_role = user.get("role", "coordinator") if user else "system"
    actor_role_label = get_actor_role_label(user, target_program)
    actor_program = (user.get("coordinatorProgram") or target_program) if user else target_program

    doc_ref.set({
        "logId": doc_id,
        "queueId": queue_id,
        "action": action,
        "actorName": actor_name,
        "actorRole": actor_role,
        "actorRoleLabel": actor_role_label,
        "actorProgram": actor_program,
        "targetProgram": target_program,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })