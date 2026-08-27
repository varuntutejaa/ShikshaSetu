import uuid

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.schemas.lesson import (
    GenerateAudioRequest,
    LessonContentResponse,
    LessonGenerateRequest,
    LessonResponse,
)
from app.services.lesson_service import LessonService, get_lesson_service
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/lessons", tags=["lessons"])


def _to_response(lesson) -> LessonResponse:
    return LessonResponse(
        id=lesson.id,
        title=lesson.topic,
        grade=lesson.grade,
        subject=lesson.subject,
        topic=lesson.topic,
        teacher_language=lesson.teacher_language,
        student_language=lesson.student_language,
        learning_objectives=lesson.learning_objectives,
        teacher_script=lesson.teacher_script,
        mother_tongue_script=lesson.mother_tongue_script,
        activity=lesson.activity,
        assessment_topics=lesson.assessment_topics,
        created_at=lesson.created_at,
    )


@router.post("/generate", response_model=LessonResponse)
async def generate_lesson(
    request: LessonGenerateRequest,
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonResponse:
    lesson = await service.generate(db, request)
    return _to_response(lesson)


@router.get("/{lesson_id}", response_model=LessonResponse)
async def get_lesson(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonResponse:
    lesson = await service.get(db, lesson_id)
    return _to_response(lesson)


@router.post("/{lesson_id}/audio", response_model=LessonContentResponse)
async def generate_lesson_audio(
    lesson_id: uuid.UUID,
    request: GenerateAudioRequest,
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonContentResponse:
    content = await service.generate_audio(db, lesson_id, request.script, request.language)
    return LessonContentResponse.model_validate(content)


@router.post("/{lesson_id}/worksheet", response_model=LessonContentResponse)
async def generate_lesson_worksheet(
    lesson_id: uuid.UUID,
    language: str = "hi",
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonContentResponse:
    content = await service.generate_worksheet(db, lesson_id, language)
    return LessonContentResponse.model_validate(content)
