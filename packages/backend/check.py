import os
from dotenv import load_dotenv
load_dotenv()
from app.core.firebase import db

docs = db.collection("courses").where("courseCode", "==", "GEC 02").stream()
for d in docs:
    print(d.to_dict())
