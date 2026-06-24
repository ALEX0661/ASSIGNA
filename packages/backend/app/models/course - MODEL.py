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
    preferredRoom: Optional[str] = None   # e.g. "Room 407" — pins course to a specific room

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    program: Optional[str] = None
    yearLevel: Optional[int] = None
    unitsLecture: Optional[int] = None
    unitsLab: Optional[int] = None
    blocks: Optional[int] = None
    preferredRoom: Optional[str] = None   # "" or None = no preference; "Room 407" = pinned