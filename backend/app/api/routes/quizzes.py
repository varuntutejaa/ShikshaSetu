import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.quiz import (
    QuizAttemptRequest,
    QuizAttemptResponse,
    QuizGenerateRequest,
    QuizStudentResponse,
    QuizTeacherResponse,
)
from app.services.quiz_service import QuizService, get_quiz_service

router = APIRouter(prefix="/api/quizzes", tags=["quizzes"])


@router.post("/generate", response_model=QuizTeacherResponse)
async def generate_quiz(
    request: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db),
    service: QuizService = Depends(get_quiz_service),
) -> QuizTeacherResponse:
    quiz = await service.generate(db, request)
    return QuizTeacherResponse.model_validate(quiz)


@router.get("/{quiz_id}", response_model=QuizTeacherResponse)
async def get_quiz_for_teacher(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: QuizService = Depends(get_quiz_service),
) -> QuizTeacherResponse:
    quiz = await service.get(db, quiz_id)
    return QuizTeacherResponse.model_validate(quiz)


@router.get("/{quiz_id}/student-view", response_model=QuizStudentResponse)
async def get_quiz_for_student(
    quiz_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: QuizService = Depends(get_quiz_service),
) -> QuizStudentResponse:
    """Same quiz, correct_answer withheld — this is what the Android app should call."""
    quiz = await service.get(db, quiz_id)
    return QuizStudentResponse.model_validate(quiz)


@router.post("/{quiz_id}/attempt", response_model=QuizAttemptResponse)
async def submit_quiz_attempt(
    quiz_id: uuid.UUID,
    request: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    service: QuizService = Depends(get_quiz_service),
) -> QuizAttemptResponse:
    attempt = await service.submit_attempt(db, quiz_id, request)
    return QuizAttemptResponse.model_validate(attempt)
