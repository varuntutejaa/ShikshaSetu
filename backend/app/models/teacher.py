import uuid

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Teacher(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "teachers"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    school_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    default_teacher_language: Mapped[str] = mapped_column(String(8), default="hi", nullable=False)
    default_student_language: Mapped[str] = mapped_column(String(8), default="sat", nullable=False)

    classes: Mapped[list["ClassModel"]] = relationship(back_populates="teacher")  # noqa: F821
