import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class VivaSession(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "viva_sessions"

    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True
    )
    subject: Mapped[str] = mapped_column(String(120), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    num_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="in_progress", nullable=False)

    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total: Mapped[int | None] = mapped_column(Integer, nullable=True)
    strengths: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    weaknesses: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    recommended_interventions: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student: Mapped["Student"] = relationship(back_populates="viva_sessions")  # noqa: F821
    questions: Mapped[list["VivaQuestion"]] = relationship(
        back_populates="viva_session", cascade="all, delete-orphan", order_by="VivaQuestion.order_index"
    )


class VivaQuestion(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "viva_questions"

    viva_session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("viva_sessions.id", ondelete="CASCADE"), nullable=False
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    question: Mapped[str] = mapped_column(Text, nullable=False)
    competency: Mapped[str | None] = mapped_column(String(120), nullable=True)

    viva_session: Mapped["VivaSession"] = relationship(back_populates="questions")
    answer: Mapped["VivaAnswer | None"] = relationship(
        back_populates="viva_question", uselist=False, cascade="all, delete-orphan"
    )


class VivaAnswer(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "viva_answers"

    viva_question_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("viva_questions.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    student_answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    correct: Mapped[bool] = mapped_column(nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)

    viva_question: Mapped["VivaQuestion"] = relationship(back_populates="answer")
