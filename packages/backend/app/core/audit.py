import uuid
from datetime import datetime, timezone
from app.core.firebase import db

def get_actor_name(user: dict) -> str:
    """Helper to extract a readable name from the user token."""
    if not user:
        return "System"
    return user.get("name") or user.get("email") or "Unknown User"

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
    
    doc_ref.set({
        "logId": doc_id,
        "queueId": queue_id,
        "action": action,
        "actorName": actor_name,
        "actorRole": actor_role,
        "targetProgram": target_program,
        "details": details,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })
