import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.student import StudentResponse


class TeacherResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    school_name: str | None
    default_teacher_language: str
    default_student_language: str


class StudentLoginRequest(BaseModel):
    student_id: str = Field(..., min_length=3, max_length=32, description="The student's login ID, e.g. STU1001")
    password: str = Field(..., min_length=4, max_length=128)


class StudentRegisterRequest(BaseModel):
    """Demo/admin-only: creates a student login. Guarded by X-Admin-Key when
    ADMIN_API_KEY is configured — see app/api/routes/auth.py."""

    student_id: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=4, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    grade: int = Field(..., ge=1, le=12)
    mother_tongue: str = Field(default="sat", max_length=8)
    school: str | None = Field(default=None, max_length=255)
    class_id: uuid.UUID | None = None


class StudentAuthResponse(BaseModel):
    token: str
    expires_at: datetime
    student: StudentResponse


class TeacherLoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)


class TeacherRegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=4, max_length=128)
    phone: str | None = Field(default=None, max_length=32)
    school_name: str | None = Field(default=None, max_length=255)
    default_teacher_language: str = Field(default="hi", max_length=8)
    default_student_language: str = Field(default="sat", max_length=8)


class TeacherAuthResponse(BaseModel):
    token: str
    expires_at: datetime
    teacher: TeacherResponse
