import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
import os
import json

def init_firebase():
    cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
    
    if not cred_json:
        raise ValueError("FIREBASE_CREDENTIALS_JSON not set!")

    cred_dict = json.loads(cred_json)
    
    # Fix the private key newlines (Railway can sometimes escape them)
    cred_dict["private_key"] = cred_dict["private_key"].replace("\\n", "\n")

    cred = credentials.Certificate(cred_dict)
    
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)

init_firebase()
db = firestore.client()
#cred = credentials.Certificate(
 #   json.loads(os.environ["FIREBASE_CREDENTIALS_JSON"])
#)
#firebase_admin.initialize_app(cred)


# ── Module-level caches ───────────────────────────────────────────────────────
# These are loaded once and refreshed explicitly after any mutation.
# Single-worker only — multiple workers would have separate memory.

_courses_cache = []
_faculty_cache = []
_rooms_cache = {"lecture": [], "lab": []}
_time_cache = {"start_time": 7, "end_time": 21}
_days_cache = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def refresh_courses_cache():
    global _courses_cache
    _courses_cache = [
        {**d.to_dict(), "id": d.id}
        for d in db.collection("courses").stream()
    ]


def refresh_faculty_cache():
    global _faculty_cache
    _faculty_cache = [
        {**d.to_dict(), "id": d.id}
        for d in db.collection("faculty").stream()
    ]


def refresh_rooms_cache():
    global _rooms_cache
    doc = db.collection("rooms").document("rooms").get()
    if doc.exists:
        _rooms_cache = doc.to_dict()


def refresh_time_cache():
    global _time_cache
    doc = db.collection("settings").document("time").get()
    if doc.exists:
        _time_cache = doc.to_dict()


def refresh_days_cache():
    global _days_cache
    doc = db.collection("settings").document("days").get()
    if doc.exists:
        _days_cache = doc.to_dict().get("days", _days_cache)


def get_courses():
    return _courses_cache


def get_faculty():
    return _faculty_cache


def get_rooms():
    return _rooms_cache


def get_time():
    return _time_cache


def get_days():
    return _days_cache


def load_all_caches():
    """Call this once on startup to warm all caches."""
    refresh_courses_cache()
    refresh_faculty_cache()
    refresh_rooms_cache()
    refresh_time_cache()
    refresh_days_cache()
