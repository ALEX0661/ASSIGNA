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
    semester: str = "1st Semester"  # "1st Semester", "2nd Semester", "Midyear"

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    program: Optional[str] = None
    yearLevel: Optional[int] = None
    unitsLecture: Optional[int] = None
    unitsLab: Optional[int] = None
    blocks: Optional[int] = None
    semester: Optional[str] = None