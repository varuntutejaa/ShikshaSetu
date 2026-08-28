"""A live class session — the shared handle that coordinates the two
independent realtime pipelines (LiveKit video room + AI audio WebSocket).
This table only tracks lifecycle/metadata; neither pipeline's media ever
touches the database.
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class ClassSession(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "class_sessions"

    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    teacher_language: Mapped[str] = mapped_column(String(8), default="hi", nullable=False)
    student_language: Mapped[str] = mapped_column(String(8), default="sat", nullable=False)
    # "active" | "ended" — the video room name and audio WS both key off this
    # session's id regardless of status; ending it is purely a lifecycle flag
    # teachers/students can check, not something that tears down a live socket.
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("lessons.id", ondelete="SET NULL"), nullable=True
    )
    current_slide_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    class_ref: Mapped["ClassModel | None"] = relationship()  # noqa: F821


class ClassSessionParticipant(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "class_session_participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("class_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="SET NULL"), nullable=True, index=True
    )
    participant_type: Mapped[str] = mapped_column(String(16), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="online", nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["ClassSession"] = relationship()
    student: Mapped["Student | None"] = relationship()  # noqa: F821
