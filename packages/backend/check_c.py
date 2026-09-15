import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

cred_json = os.environ.get('FIREBASE_CREDENTIALS_JSON')
if cred_json.startswith("'") and cred_json.endswith("'"):
    cred_json = cred_json[1:-1]
cred_dict = json.loads(cred_json)
cred = credentials.Certificate(cred_dict)

firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection("coordinator_schedules").stream()
for d in docs:
    data = d.to_dict()
    print(f"{d.id}: status={data.get('status')} note={data.get('unfinalizedNote')} rejection={data.get('rejectionFeedback')}")
