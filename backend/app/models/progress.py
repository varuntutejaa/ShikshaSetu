import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, Float, ForeignKey, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class StudentProgress(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "student_progress"

    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    competency: Mapped[str | None] = mapped_column(String(120), nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    extra_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    student: Mapped["Student"] = relationship(back_populates="progress_events")  # noqa: F821


class SyncEvent(Base, UUIDPKMixin, TimestampMixin):
    """Records an idempotency key (student_id, event_id) for offline sync.

    Re-submitting the same event_id for a student is a no-op — it's looked
    up and reported as already-processed rather than re-applied.
    """

    __tablename__ = "sync_events"
    __table_args__ = (UniqueConstraint("student_id", "event_id", name="uq_sync_student_event"),)

    student_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="processed", nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
