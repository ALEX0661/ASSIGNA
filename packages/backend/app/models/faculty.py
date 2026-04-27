from pydantic import BaseModel
from typing import List, Optional


class Specialization(BaseModel):
    courseCode: str
    rating: int


class Faculty(BaseModel):
    name: str
    email: Optional[str] = None
    status: str = "full-time"
    AcademicRank: Optional[str] = None
    Department: Optional[str] = None
    Educational_attainment: Optional[str] = None
    Sex: Optional[str] = None
    units: float = 0.0
    max_units: float = 21.0
    specializations: List[Specialization] = []
    preferredDays: List[str] = []
    preferredTimeStart: float = 7.0
    preferredTimeEnd: float = 21.0
    maxConsecutiveHours: float = 4.0


class FacultyUpdate(BaseModel):
    # Identity / profile
    name: Optional[str] = None
    email: Optional[str] = None

    # Employment
    status: Optional[str] = None
    AcademicRank: Optional[str] = None
    Department: Optional[str] = None
    Educational_attainment: Optional[str] = None
    Sex: Optional[str] = None

    # Load
    max_units: Optional[float] = None
    units: Optional[float] = None

    # Specializations
    specializations: Optional[List[Specialization]] = None

    # Schedule preferences
    preferredDays: Optional[List[str]] = None
    preferredTimeStart: Optional[float] = None
    preferredTimeEnd: Optional[float] = None
    maxConsecutiveHours: Optional[float] = None