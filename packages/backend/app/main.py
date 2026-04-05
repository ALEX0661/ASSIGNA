from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

from app.core import firebase  # initializes Firebase on import
from app.routers import health, faculty, courses, schedule, settings, overrides

app = FastAPI(title="LOGOS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(faculty.router,   prefix="/faculty")
app.include_router(courses.router,   prefix="/courses")
app.include_router(schedule.router,  prefix="/schedule")
app.include_router(settings.router,  prefix="/settings")
app.include_router(overrides.router, prefix="/overrides")