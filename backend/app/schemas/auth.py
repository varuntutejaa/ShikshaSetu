import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.student import StudentResponse


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
