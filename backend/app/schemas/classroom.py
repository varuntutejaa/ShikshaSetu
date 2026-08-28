import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.languages import is_supported_language


class ClassSessionCreateRequest(BaseModel):
    teacher_id: uuid.UUID | None = None
    class_id: uuid.UUID | None = None
    teacher_language: str = Field(default="hi")
    student_language: str = Field(default="sat")

    @field_validator("teacher_language", "student_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class ClassCreateRequest(BaseModel):
    teacher_id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=160)
    grade: int = Field(..., ge=1, le=12)
    section: str | None = Field(default=None, max_length=16)
    subject_focus: str | None = Field(default=None, max_length=120)
    teacher_language: str = Field(default="hi")
    student_language: str = Field(default="sat")

    @field_validator("teacher_language", "student_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class ClassJoinRequest(BaseModel):
    class_code: str = Field(..., min_length=4, max_length=12)
    student_id: uuid.UUID | None = None
    display_name: str | None = Field(default=None, max_length=255)


class ClassResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    teacher_id: uuid.UUID | None
    name: str | None
    class_code: str
    grade: int
    section: str | None
    subject_focus: str | None
    teacher_language: str
    student_language: str
    created_at: datetime


class ClassSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: uuid.UUID = Field(validation_alias="id")
    teacher_id: uuid.UUID | None
    class_id: uuid.UUID | None
    teacher_language: str
    student_language: str
    status: str
    lesson_id: uuid.UUID | None = None
    current_slide_index: int = 0
    created_at: datetime
    ended_at: datetime | None


class SessionContentRequest(BaseModel):
    lesson_id: uuid.UUID | None = None
    slide_index: int = Field(default=0, ge=0)


class SessionContentResponse(BaseModel):
    session_id: uuid.UUID
    lesson_id: uuid.UUID | None
    current_slide_index: int
    offline_pack: dict | None = None


class ParticipantResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    student_id: uuid.UUID | None
    participant_type: str
    display_name: str
    status: str
    joined_at: datetime
    left_at: datetime | None


class ClassJoinResponse(BaseModel):
    classroom: ClassResponse
    active_session: ClassSessionResponse | None


class ParticipantType(str, Enum):
    teacher = "teacher"
    student = "student"


class LiveKitTokenRequest(BaseModel):
    session_id: uuid.UUID
    participant_type: ParticipantType
    # Optional stable identity (e.g. a student id) so reconnects resolve to
    # the same LiveKit participant instead of a fresh anonymous one.
    identity: str | None = None


class LiveKitTokenResponse(BaseModel):
    token: str
    url: str
    room: str
