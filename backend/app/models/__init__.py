"""Import every model so they register on Base.metadata for create_all()."""

from app.models.class_model import ClassModel
from app.models.lesson import Lesson, LessonContent
from app.models.progress import StudentProgress, SyncEvent
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.student import Student
from app.models.teacher import Teacher
from app.models.viva import VivaAnswer, VivaQuestion, VivaSession

__all__ = [
    "Teacher",
    "ClassModel",
    "Student",
    "Lesson",
    "LessonContent",
    "Quiz",
    "QuizQuestion",
    "QuizAttempt",
    "VivaSession",
    "VivaQuestion",
    "VivaAnswer",
    "StudentProgress",
    "SyncEvent",
]
