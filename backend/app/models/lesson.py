import uuid

from sqlalchemy import JSON, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Lesson(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "lessons"

    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True
    )
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    subject: Mapped[str] = mapped_column(String(120), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    teacher_language: Mapped[str] = mapped_column(String(8), nullable=False)
    student_language: Mapped[str] = mapped_column(String(8), nullable=False)

    learning_objectives: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    teacher_script: Mapped[str] = mapped_column(Text, nullable=False)
    mother_tongue_script: Mapped[str] = mapped_column(Text, nullable=False)
    activity: Mapped[str] = mapped_column(Text, nullable=False)
    assessment_topics: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)

    class_ref: Mapped["ClassModel"] = relationship(back_populates="lessons")  # noqa: F821
    quizzes: Mapped[list["Quiz"]] = relationship(back_populates="lesson")  # noqa: F821
    content_items: Mapped[list["LessonContent"]] = relationship(
        back_populates="lesson", cascade="all, delete-orphan"
    )


class LessonContent(Base, UUIDPKMixin, TimestampMixin):
    """Generated ancillary content for a lesson (audio narration, worksheet).

    Binary audio is never stored in Postgres — TTS output is written to disk
    (or would be, to object storage, in production) and only the reference
    URL is persisted here.
    """

    __tablename__ = "lesson_content"

    lesson_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("lessons.id", ondelete="CASCADE"), nullable=False
    )
    content_type: Mapped[str] = mapped_column(String(32), nullable=False)  # audio | worksheet
    language: Mapped[str] = mapped_column(String(8), nullable=False)
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    lesson: Mapped["Lesson"] = relationship(back_populates="content_items")
