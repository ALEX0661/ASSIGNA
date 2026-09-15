from app.core.firebase import db

queues = db.collection("coordinator_queues").stream()
for q in queues:
    print(f"Queue {q.id}: status={q.to_dict().get('status')}")
