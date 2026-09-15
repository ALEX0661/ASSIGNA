import firebase_admin
from firebase_admin import credentials, firestore
import json
import os

with open(".env") as f:
    env = f.read()
    
cred_str = env.split("FIREBASE_CREDENTIALS_JSON=")[1].strip()
if cred_str.startswith("'"):
    cred_str = cred_str[1:-1]
    
cred_dict = json.loads(cred_str)
cred = credentials.Certificate(cred_dict)
firebase_admin.initialize_app(cred)
db = firestore.client()

docs = db.collection("coordinator_schedules").stream()
for d in docs:
    data = d.to_dict()
    print(f"{d.id}: status={data.get('status')} note={data.get('unfinalizedNote')} rejection={data.get('rejectionFeedback')}")
