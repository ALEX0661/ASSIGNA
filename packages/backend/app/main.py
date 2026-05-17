from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core import firebase          # initialises Firebase on import
from app.core.firebase import load_all_caches

from app.routers import (
    health,
    faculty,
    courses,
    schedule,
    settings,
    overrides,
    analytics,
    block_config,
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
    """Warm all Firestore caches on boot so the first solve is fast."""
    load_all_caches()


app.include_router(health.router,       tags=["Health"])
app.include_router(faculty.router,      prefix="/faculty",       tags=["Faculty"])
app.include_router(courses.router,      prefix="/courses",       tags=["Courses"])
app.include_router(schedule.router,     prefix="/schedule",      tags=["Schedule"])
app.include_router(settings.router,     prefix="/settings",      tags=["Settings"])
app.include_router(overrides.router,    prefix="/overrides",     tags=["Overrides"])
app.include_router(analytics.router,    prefix="/analytics",     tags=["Analytics"])
app.include_router(block_config.router, prefix="/block-config",  tags=["Block Config"])
