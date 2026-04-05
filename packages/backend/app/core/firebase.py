import firebase_admin
from firebase_admin import credentials, firestore, auth
import os, json

cred = credentials.Certificate(
    json.loads(os.environ["FIREBASE_CREDENTIALS_JSON"])
)
firebase_admin.initialize_app(cred)
db = firestore.client()

_courses_cache = []
_faculty_cache = []
_rooms_cache = {}
_time_cache = {}
_days_cache = []

def refresh_courses_cache():
    global _courses_cache
    _courses_cache = [d.to_dict() | {"id": d.id}
                      for d in db.collection("courses").stream()]

def refresh_faculty_cache():
    global _faculty_cache
    _faculty_cache = [d.to_dict() | {"id": d.id}
                      for d in db.collection("faculty").stream()]

def get_courses(): return _courses_cache
def get_faculty(): return _faculty_cache
def get_rooms():   return _rooms_cache
def get_time():    return _time_cache
def get_days():    return _days_cache