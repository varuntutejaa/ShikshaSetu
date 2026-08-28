import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.languages import is_supported_language


class LessonGenerateRequest(BaseModel):
    grade: int = Field(..., ge=1, le=8)
    subject: str = Field(..., min_length=1, max_length=120)
    topic: str = Field(..., min_length=1, max_length=255)
    teacher_language: str = Field(default="hi")
    student_language: str = Field(default="sat")
    description: str | None = Field(default=None, max_length=2000)
    class_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None

    @field_validator("teacher_language", "student_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class LessonResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    grade: int
    subject: str
    topic: str
    teacher_language: str
    student_language: str
    learning_objectives: list[str]
    teacher_script: str
    mother_tongue_script: str
    activity: str
    assessment_topics: list[str]
    downloadable: bool = False
    created_at: datetime


class LessonContentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    content_type: str
    language: str
    text_content: str | None
    audio_url: str | None
    metadata_json: dict | None = None
    created_at: datetime


class GenerateAudioRequest(BaseModel):
    language: str = Field(default="sat")
    script: str = Field(..., description="Which script to narrate: 'teacher' or 'mother_tongue'")

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class TeachingPackResponse(BaseModel):
    lesson: LessonResponse
    content: list[LessonContentResponse]
    quiz_id: uuid.UUID | None = None
    viva_seed: dict
    offline_manifest: dict


class DownloadableRequest(BaseModel):
    downloadable: bool = True
