import uuid

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class ClassModel(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "classes"

    teacher_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("teachers.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    class_code: Mapped[str] = mapped_column(String(12), unique=True, index=True, nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    section: Mapped[str | None] = mapped_column(String(16), nullable=True)
    subject_focus: Mapped[str | None] = mapped_column(String(120), nullable=True)
    teacher_language: Mapped[str] = mapped_column(String(8), default="hi", nullable=False)
    student_language: Mapped[str] = mapped_column(String(8), default="sat", nullable=False)

    teacher: Mapped["Teacher"] = relationship(back_populates="classes")  # noqa: F821
    students: Mapped[list["Student"]] = relationship(back_populates="class_ref")  # noqa: F821
    lessons: Mapped[list["Lesson"]] = relationship(back_populates="class_ref")  # noqa: F821
