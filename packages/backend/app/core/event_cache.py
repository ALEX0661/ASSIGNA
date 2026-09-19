"""Thread-safe TTL cache for Firestore event subcollections.

Schedule events live in subcollections (one Firestore document per event),
so reading a 500-event schedule costs 500 reads.  These schedules are
read-heavy / write-rare — an admin reviews them many times for every one
edit — so caching the assembled list in memory for a short window
dramatically cuts Firestore reads without ever serving stale data, because
every write path explicitly invalidates its cache entry.

Usage
-----
    from app.core.event_cache import event_cache

    # Read (returns None on miss → caller fetches from Firestore & calls put())
    events = event_cache.get("final:My Schedule")

    # Write-through after a Firestore read
    event_cache.put("final:My Schedule", events_from_firestore)

    # Invalidate after a save/edit/delete
    event_cache.invalidate("final:My Schedule")

Key conventions
---------------
    "final:{name}"          – final_schedules/{name}/events
    "master:{master_doc_id}" – master_schedules/{id}/events
"""

import time
import threading
import logging

logger = logging.getLogger(__name__)


class EventCache:
    def __init__(self, ttl_seconds: int = 120, max_entries: int = 30):
        self._store: dict[str, tuple[list, float]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds
        self._max = max_entries

    # ── reads ────────────────────────────────────────────────────────────

    def get(self, key: str) -> list | None:
        """Return cached events if fresh, else None."""
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            events, ts = entry
            if (time.time() - ts) >= self._ttl:
                del self._store[key]
                return None
            return events

    # ── writes ───────────────────────────────────────────────────────────

    def put(self, key: str, events: list) -> None:
        """Store an event list (shallow copy)."""
        with self._lock:
            if len(self._store) >= self._max and key not in self._store:
                oldest = min(self._store, key=lambda k: self._store[k][1])
                del self._store[oldest]
            # Shallow-copy the list so callers mutating their copy don't
            # corrupt the cache (the dicts inside are never mutated in
            # the read-only view paths).
            self._store[key] = (list(events), time.time())

    # ── invalidation ─────────────────────────────────────────────────────

    def invalidate(self, key: str) -> None:
        """Drop a single entry."""
        with self._lock:
            if self._store.pop(key, None) is not None:
                logger.debug("event_cache: invalidated %s", key)

    def invalidate_prefix(self, prefix: str) -> None:
        """Drop every entry whose key starts with *prefix*."""
        with self._lock:
            to_drop = [k for k in self._store if k.startswith(prefix)]
            for k in to_drop:
                del self._store[k]
            if to_drop:
                logger.debug("event_cache: invalidated %d keys with prefix %s", len(to_drop), prefix)

    def clear(self) -> None:
        with self._lock:
            n = len(self._store)
            self._store.clear()
            if n:
                logger.debug("event_cache: cleared %d entries", n)

    # ── diagnostics ──────────────────────────────────────────────────────

    def stats(self) -> dict:
        with self._lock:
            now = time.time()
            return {
                "entries": len(self._store),
                "keys": list(self._store.keys()),
                "oldest_age_s": round(now - min((v[1] for v in self._store.values()), default=now), 1),
            }


# Singleton — imported by schedule.py and approval.py
event_cache = EventCache(ttl_seconds=120, max_entries=30)
