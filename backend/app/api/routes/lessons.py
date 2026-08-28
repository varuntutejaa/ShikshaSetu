import uuid

from fastapi import APIRouter, Depends

from app.core.database import get_db
from app.schemas.lesson import (
    GenerateAudioRequest,
    DownloadableRequest,
    LessonContentResponse,
    LessonGenerateRequest,
    LessonResponse,
    TeachingPackResponse,
)
from app.schemas.quiz import Difficulty, QuestionType, QuizGenerateRequest
from app.services.lesson_service import LessonService, get_lesson_service
from app.services.quiz_service import QuizService, get_quiz_service
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
        downloadable=lesson.downloadable,
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


@router.post("/{lesson_id}/flashcards", response_model=LessonContentResponse)
async def generate_lesson_flashcards(
    lesson_id: uuid.UUID,
    language: str = "sat",
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonContentResponse:
    content = await service.generate_flashcards(db, lesson_id, language)
    return LessonContentResponse.model_validate(content)


@router.patch("/{lesson_id}/downloadable", response_model=LessonResponse)
async def set_lesson_downloadable(
    lesson_id: uuid.UUID,
    request: DownloadableRequest,
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonResponse:
    lesson = await service.set_downloadable(db, lesson_id, request.downloadable)
    return _to_response(lesson)


@router.get("/{lesson_id}/offline-pack")
async def get_offline_pack(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
):
    return await service.offline_pack(db, lesson_id)


@router.post("/{lesson_id}/teaching-pack", response_model=TeachingPackResponse)
async def generate_teaching_pack(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    lesson_service: LessonService = Depends(get_lesson_service),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> TeachingPackResponse:
    lesson = await lesson_service.get(db, lesson_id)
    audio = await lesson_service.generate_audio(db, lesson_id, "mother_tongue", lesson.student_language)
    worksheet = await lesson_service.generate_worksheet(db, lesson_id, lesson.student_language)
    flashcards = await lesson_service.generate_flashcards(db, lesson_id, lesson.student_language)
    quiz = await quiz_service.generate(
        db,
        QuizGenerateRequest(
            lesson_id=lesson_id,
            number_of_questions=5,
            language=lesson.student_language,
            types=[QuestionType.mcq],
            difficulty=Difficulty.easy,
        ),
    )
    lesson = await lesson_service.set_downloadable(db, lesson_id, True)
    return TeachingPackResponse(
        lesson=_to_response(lesson),
        content=[LessonContentResponse.model_validate(c) for c in [audio, worksheet, flashcards]],
        quiz_id=quiz.id,
        viva_seed={"lesson_id": str(lesson.id), "subject": lesson.subject, "topic": lesson.topic},
        offline_manifest=await lesson_service.offline_pack(db, lesson_id),
    )


@router.post("/{lesson_id}/worksheet", response_model=LessonContentResponse)
async def generate_lesson_worksheet(
    lesson_id: uuid.UUID,
    language: str = "hi",
    db: AsyncSession = Depends(get_db),
    service: LessonService = Depends(get_lesson_service),
) -> LessonContentResponse:
    content = await service.generate_worksheet(db, lesson_id, language)
    return LessonContentResponse.model_validate(content)
