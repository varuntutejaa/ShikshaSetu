import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.languages import is_supported_language


class VivaStartRequest(BaseModel):
    student_id: uuid.UUID
    subject: str = Field(..., min_length=1, max_length=120)
    topic: str = Field(..., min_length=1, max_length=255)
    language: str = Field(default="sat")
    number_of_questions: int = Field(default=10, ge=1, le=20)
    lesson_id: uuid.UUID | None = None

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class VivaQuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question: str
    competency: str | None
    order_index: int


class VivaStartResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    subject: str
    topic: str
    language: str
    num_questions: int
    status: str
    first_question: VivaQuestionResponse


class VivaAnswerRequest(BaseModel):
    question_id: uuid.UUID
    student_answer_text: str = Field(..., min_length=1, max_length=2000)


class VivaAnswerResponse(BaseModel):
    correct: bool
    score: float
    confidence: float
    feedback: str
    competency: str | None
    next_question: VivaQuestionResponse | None = None
    is_last_question: bool = False


class VivaReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    student_id: uuid.UUID
    score: int
    total: int
    strengths: list[str]
    weaknesses: list[str]
    recommended_interventions: list[str]
    completed_at: datetime | None
