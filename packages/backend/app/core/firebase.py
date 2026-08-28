import firebase_admin
from firebase_admin import credentials, firestore, auth as firebase_auth
from google.api_core.exceptions import GoogleAPICallError, RetryError
import os
import json
import time
import logging

logger = logging.getLogger("firebase")

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


# ── Module-level caches ───────────────────────────────────────────────────────
# These are loaded once and refreshed explicitly after any mutation.
# Single-worker only — multiple workers would have separate memory.

_courses_cache = []
_faculty_cache = []
_rooms_cache = {"lecture": [], "lab": []}
_time_cache = {"start_time": 7, "end_time": 21}
_days_cache = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

# Tracks whether each cache's most recent refresh came live from Firestore
# or fell back to a disk snapshot / in-memory default. Surfaced by
# get_cache_status() so startup can log a clear "degraded" warning instead
# of silently running on stale data.
_cache_status = {
    "courses": "unloaded",
    "faculty": "unloaded",
    "rooms": "unloaded",
    "time": "unloaded",
    "days": "unloaded",
}

def get_cache_status():
    return dict(_cache_status)

# ── Disk fallback ─────────────────────────────────────────────────────────────
# If Firestore is unreachable (quota exhausted, network blip, etc.) at startup,
# fall back to the last known-good snapshot on disk instead of crashing the
# app or booting with empty caches. Written after every successful refresh.
_CACHE_DIR = os.getenv("CACHE_DIR", os.path.join(os.path.dirname(__file__), ".cache"))
os.makedirs(_CACHE_DIR, exist_ok=True)

def _cache_path(name):
    return os.path.join(_CACHE_DIR, f"{name}.json")

def _save_snapshot(name, data):
    try:
        with open(_cache_path(name), "w", encoding="utf-8") as f:
            json.dump(data, f)
    except OSError as e:
        # Disk write failing is not fatal — we just lose the fallback for next time.
        logger.warning(f"Could not persist {name} snapshot to disk: {e}")

def _load_snapshot(name, default):
    path = _cache_path(name)
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning(f"Could not read {name} snapshot from disk: {e}")
        return default


# ── Retry with backoff ────────────────────────────────────────────────────────
# Handles transient Firestore errors (quota exhaustion, brief outages) by
# retrying a few times with increasing delay before giving up. Quota errors
# in particular are usually short-lived rate limiting, not a hard ceiling.
def _retry(fn, *, retries=3, base_delay=1.5, label=""):
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            return fn()
        except (GoogleAPICallError, RetryError) as e:
            last_err = e
            if attempt == retries:
                break
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning(f"{label} failed (attempt {attempt}/{retries}): {e}. Retrying in {delay:.1f}s…")
            time.sleep(delay)
    raise last_err


def refresh_courses_cache():
    global _courses_cache
    try:
        _courses_cache = _retry(
            lambda: [{**d.to_dict(), "id": d.id} for d in db.collection("courses").stream()],
            label="refresh_courses_cache",
        )
        _save_snapshot("courses", _courses_cache)
        _cache_status["courses"] = "live"
    except (GoogleAPICallError, RetryError) as e:
        logger.error(f"refresh_courses_cache: giving up, falling back to disk snapshot: {e}")
        _courses_cache = _load_snapshot("courses", _courses_cache)
        _cache_status["courses"] = "fallback"


def refresh_faculty_cache():
    global _faculty_cache
    try:
        _faculty_cache = _retry(
            lambda: [{**d.to_dict(), "id": d.id} for d in db.collection("faculty").stream()],
            label="refresh_faculty_cache",
        )
        _save_snapshot("faculty", _faculty_cache)
        _cache_status["faculty"] = "live"
    except (GoogleAPICallError, RetryError) as e:
        logger.error(f"refresh_faculty_cache: giving up, falling back to disk snapshot: {e}")
        _faculty_cache = _load_snapshot("faculty", _faculty_cache)
        _cache_status["faculty"] = "fallback"


def refresh_rooms_cache():
    global _rooms_cache
    try:
        def _fetch():
            doc = db.collection("rooms").document("rooms").get()
            return doc.to_dict() if doc.exists else None
        result = _retry(_fetch, label="refresh_rooms_cache")
        if result is not None:
            _rooms_cache = result
            _save_snapshot("rooms", _rooms_cache)
        _cache_status["rooms"] = "live"
    except (GoogleAPICallError, RetryError) as e:
        logger.error(f"refresh_rooms_cache: giving up, falling back to disk snapshot: {e}")
        _rooms_cache = _load_snapshot("rooms", _rooms_cache)
        _cache_status["rooms"] = "fallback"


def refresh_time_cache():
    global _time_cache
    try:
        def _fetch():
            doc = db.collection("settings").document("time").get()
            return doc.to_dict() if doc.exists else None
        result = _retry(_fetch, label="refresh_time_cache")
        if result is not None:
            _time_cache = result
            _save_snapshot("time", _time_cache)
        _cache_status["time"] = "live"
    except (GoogleAPICallError, RetryError) as e:
        logger.error(f"refresh_time_cache: giving up, falling back to disk snapshot: {e}")
        _time_cache = _load_snapshot("time", _time_cache)
        _cache_status["time"] = "fallback"


def refresh_days_cache():
    global _days_cache
    try:
        def _fetch():
            doc = db.collection("settings").document("days").get()
            return doc.to_dict().get("days") if doc.exists else None
        result = _retry(_fetch, label="refresh_days_cache")
        if result is not None:
            _days_cache = result
            _save_snapshot("days", _days_cache)
        _cache_status["days"] = "live"
    except (GoogleAPICallError, RetryError) as e:
        logger.error(f"refresh_days_cache: giving up, falling back to disk snapshot: {e}")
        _days_cache = _load_snapshot("days", _days_cache)
        _cache_status["days"] = "fallback"


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
  # Skip streaming entire Firestore collections if local snapshots exist
  global _courses_cache, _faculty_cache
  _courses_cache = _load_snapshot("courses", _courses_cache)
  _faculty_cache = _load_snapshot("faculty", _faculty_cache)
  refresh_rooms_cache()
  refresh_time_cache()
  refresh_days_cache()