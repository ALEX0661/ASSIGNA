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
    units: float = 0.0
    max_units: float = 21.0
    specializations: List[Specialization] = []
    preferredDays: List[str] = []
    preferredTimeStart: float = 7.0
    preferredTimeEnd: float = 21.0
    maxConsecutiveHours: float = 4.0

class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    AcademicRank: Optional[str] = None
    max_units: Optional[float] = None
    specializations: Optional[List[Specialization]] = None
    preferredDays: Optional[List[str]] = None
    preferredTimeStart: Optional[float] = None
    preferredTimeEnd: Optional[float] = None
    maxConsecutiveHours: Optional[float] = None