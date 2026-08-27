import uuid
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.languages import is_supported_language


class QuestionType(str, Enum):
    mcq = "mcq"
    true_false = "true_false"
    picture_based = "picture_based"
    oral = "oral"
    fill_in_blank = "fill_in_blank"


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class QuizGenerateRequest(BaseModel):
    lesson_id: uuid.UUID
    number_of_questions: int = Field(default=10, ge=1, le=25)
    language: str = Field(default="sat")
    types: list[QuestionType] = Field(
        default_factory=lambda: list(QuestionType), min_length=1
    )
    difficulty: Difficulty = Difficulty.medium

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


# --- Teacher-facing (includes correct_answer + explanation) ---


class QuizQuestionTeacherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question: str
    options: list[str] | None
    correct_answer: str
    question_type: str
    difficulty: str
    competency: str
    explanation: str | None


class QuizTeacherResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID | None
    title: str | None
    language: str
    created_at: datetime
    questions: list[QuizQuestionTeacherResponse]


# --- Student-facing (correct_answer withheld) ---


class QuizQuestionStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    question: str
    options: list[str] | None
    question_type: str
    difficulty: str


class QuizStudentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str | None
    language: str
    questions: list[QuizQuestionStudentResponse]


# --- Quiz attempt submission ---


class QuizAnswerSubmission(BaseModel):
    question_id: uuid.UUID
    student_answer: str


class QuizAttemptRequest(BaseModel):
    student_id: uuid.UUID
    answers: list[QuizAnswerSubmission]


class QuizAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    quiz_id: uuid.UUID
    student_id: uuid.UUID
    score: int
    total: int
    completed_at: datetime | None
