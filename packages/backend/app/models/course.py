from pydantic import BaseModel
from typing import Optional

class Course(BaseModel):
    courseCode: str
    title: str
    program: str
    yearLevel: int
    unitsLecture: int = 0
    unitsLab: int = 0
    blocks: int = 1
    semester: str = "1st Semester"
    preferredRoom: Optional[str] = None       # legacy single-pool field, kept for old rows
    preferredRoomLec: Optional[str] = None    # comma-joined room pool for lecture sessions
    preferredRoomLab: Optional[str] = None    # comma-joined room pool for lab sessions

class CourseUpdate(BaseModel):
    courseCode: Optional[str] = None
    title: Optional[str] = None
    program: Optional[str] = None
    yearLevel: Optional[int] = None
    unitsLecture: Optional[int] = None
    unitsLab: Optional[int] = None
    blocks: Optional[int] = None
    semester: Optional[str] = None
    preferredRoom: Optional[str] = None       # "" or None = no preference; "Room 407" = pinned (legacy)
    preferredRoomLec: Optional[str] = None    # "" or None = no lecture pool; else comma-joined room list
    preferredRoomLab: Optional[str] = None    # "" or None = no lab pool; else comma-joined room list