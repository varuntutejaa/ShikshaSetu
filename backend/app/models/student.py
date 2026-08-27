import uuid

from sqlalchemy import Float, ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPKMixin


class Student(Base, UUIDPKMixin, TimestampMixin):
    __tablename__ = "students"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    class_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("classes.id", ondelete="SET NULL"), nullable=True
    )
    mother_tongue: Mapped[str] = mapped_column(String(8), default="sat", nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False)
    school: Mapped[str | None] = mapped_column(String(255), nullable=True)
    points: Mapped[int] = mapped_column(Integer, default=120, nullable=False)
    streak_days: Mapped[int] = mapped_column(Integer, default=4, nullable=False)

    attendance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reading_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    numeracy_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    vocabulary_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    risk_level: Mapped[str] = mapped_column(String(16), default="Low", nullable=False)

    class_ref: Mapped["ClassModel"] = relationship(back_populates="students")  # noqa: F821
    progress_events: Mapped[list["StudentProgress"]] = relationship(back_populates="student")  # noqa: F821
    quiz_attempts: Mapped[list["QuizAttempt"]] = relationship(back_populates="student")  # noqa: F821
    viva_sessions: Mapped[list["VivaSession"]] = relationship(back_populates="student")  # noqa: F821

    def recompute_overall(self) -> None:
        self.overall_score = round(
            (self.reading_score + self.numeracy_score + self.vocabulary_score) / 3, 1
        )
        if self.overall_score >= 75:
            self.risk_level = "Low"
        elif self.overall_score >= 60:
            self.risk_level = "Medium"
        else:
            self.risk_level = "High"
