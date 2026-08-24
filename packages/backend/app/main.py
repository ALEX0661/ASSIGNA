from dotenv import load_dotenv
load_dotenv()

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import firebase          # initialises Firebase on import
from app.core.firebase import load_all_caches, get_cache_status

logger = logging.getLogger("uvicorn.error")

from app.routers import (
    health,
    faculty,
    courses,
    schedule,
    settings,
    overrides,
    analytics,
    block_config,
    role_management,
    coordinator,
    queue,
    approval,
)

app = FastAPI(title="ASSIGNA API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://gcassigna.web.app",        
        "https://logos-backend.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    """Warm all Firestore caches on boot so the first solve is fast.

    load_all_caches() never raises — each cache fails independently and
    falls back to its last known-good disk snapshot rather than crashing
    the app. Log the outcome so a degraded boot (serving stale data) is
    visible instead of silent.
    """
    load_all_caches()
    status = get_cache_status()
    fallback = [name for name, state in status.items() if state == "fallback"]
    if fallback:
        logger.warning(
            f"Startup cache warm degraded — running on stale disk snapshots for: {', '.join(fallback)}. "
            f"Check Firestore quota/connectivity."
        )
    else:
        logger.info("Startup cache warm complete — all caches loaded live from Firestore.")


app.include_router(health.router,            tags=["Health"])
app.include_router(faculty.router,           prefix="/faculty",       tags=["Faculty"])
app.include_router(courses.router,           prefix="/courses",       tags=["Courses"])
app.include_router(schedule.router,          prefix="/schedule",      tags=["Schedule"])
app.include_router(settings.router,          prefix="/settings",      tags=["Settings"])
app.include_router(overrides.router,         prefix="/overrides",     tags=["Overrides"])
app.include_router(analytics.router,         prefix="/analytics",     tags=["Analytics"])
app.include_router(block_config.router,      prefix="/block-config",  tags=["Block Config"])
app.include_router(role_management.router,   tags=["Role Management"])
app.include_router(coordinator.router,       prefix="/coordinator",   tags=["Coordinator"])
app.include_router(queue.router,             prefix="/queue",         tags=["Queue"])
app.include_router(approval.router,          prefix="/approval",      tags=["Approval"])