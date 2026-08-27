import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    class_id: uuid.UUID | None
    mother_tongue: str
    grade: int
    school: str | None
    points: int
    streak_days: int
    attendance: float
    reading_score: float
    numeracy_score: float
    vocabulary_score: float
    overall_score: float
    risk_level: str
    created_at: datetime


class StudentProgressEventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    event_type: str
    competency: str | None
    score: float | None
    created_at: datetime


class StudentProgressUpdateRequest(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=64)
    competency: str | None = None
    score: float | None = None
    extra_data: dict | None = None


class QuizAssessmentSummary(BaseModel):
    id: uuid.UUID
    type: str = "quiz"
    subject: str | None = None
    topic: str | None = None
    score: int
    total: int
    date: datetime


class VivaAssessmentSummary(BaseModel):
    id: uuid.UUID
    type: str = "viva"
    subject: str
    topic: str
    score: int | None
    total: int | None
    date: datetime
