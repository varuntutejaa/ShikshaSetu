import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import NotFoundError
from app.models.progress import StudentProgress
from app.models.quiz import QuizAttempt
from app.models.student import Student
from app.models.viva import VivaSession
from app.schemas.quiz import QuizAttemptRequest, QuizAttemptResponse, QuizStudentResponse
from app.schemas.student import (
    QuizAssessmentSummary,
    StudentProgressEventResponse,
    StudentProgressUpdateRequest,
    StudentResponse,
    VivaAssessmentSummary,
)
from app.schemas.sync import SyncEventIn, SyncResponse
from app.schemas.viva import VivaQuestionResponse, VivaStartRequest, VivaStartResponse
from app.services.lesson_service import LessonService, get_lesson_service
from app.services.quiz_service import QuizService, get_quiz_service
from app.services.sync_service import SyncService, get_sync_service
from app.services.viva_service import VivaService, get_viva_service

# --- Teacher-facing: /api/students (collection) -----------------------------

router = APIRouter(prefix="/api/students", tags=["students"])


async def _get_student_or_404(db: AsyncSession, student_id: uuid.UUID) -> Student:
    student = await db.get(Student, student_id)
    if student is None:
        raise NotFoundError(f"Student {student_id} not found")
    return student


@router.get("", response_model=list[StudentResponse])
async def list_students(
    class_id: uuid.UUID | None = None, db: AsyncSession = Depends(get_db)
) -> list[StudentResponse]:
    stmt = select(Student)
    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    stmt = stmt.order_by(Student.name)
    result = await db.execute(stmt)
    return [StudentResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> StudentResponse:
    student = await _get_student_or_404(db, student_id)
    return StudentResponse.model_validate(student)


@router.get("/{student_id}/progress", response_model=list[StudentProgressEventResponse])
async def get_student_progress(
    student_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[StudentProgressEventResponse]:
    await _get_student_or_404(db, student_id)
    stmt = (
        select(StudentProgress)
        .where(StudentProgress.student_id == student_id)
        .order_by(StudentProgress.created_at.desc())
    )
    result = await db.execute(stmt)
    return [StudentProgressEventResponse.model_validate(p) for p in result.scalars().all()]


@router.get("/{student_id}/assessments")
async def get_student_assessments(
    student_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> list[QuizAssessmentSummary | VivaAssessmentSummary]:
    await _get_student_or_404(db, student_id)

    quiz_result = await db.execute(
        select(QuizAttempt).where(QuizAttempt.student_id == student_id)
    )
    viva_result = await db.execute(
        select(VivaSession).where(
            VivaSession.student_id == student_id, VivaSession.status == "completed"
        )
    )

    summaries: list[QuizAssessmentSummary | VivaAssessmentSummary] = []
    for attempt in quiz_result.scalars().all():
        summaries.append(
            QuizAssessmentSummary(
                id=attempt.id,
                score=attempt.score,
                total=attempt.total,
                date=attempt.completed_at or attempt.created_at,
            )
        )
    for viva in viva_result.scalars().all():
        summaries.append(
            VivaAssessmentSummary(
                id=viva.id,
                subject=viva.subject,
                topic=viva.topic,
                score=viva.score,
                total=viva.total,
                date=viva.completed_at or viva.created_at,
            )
        )

    summaries.sort(key=lambda s: s.date, reverse=True)
    return summaries


# --- Progress tracking (section 10) -----------------------------------------


@router.post("/{student_id}/progress", response_model=StudentProgressEventResponse)
async def record_student_progress(
    student_id: uuid.UUID,
    request: StudentProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> StudentProgressEventResponse:
    await _get_student_or_404(db, student_id)
    event = StudentProgress(
        student_id=student_id,
        event_type=request.event_type,
        competency=request.competency,
        score=request.score,
        extra_data=request.extra_data,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return StudentProgressEventResponse.model_validate(event)


# --- Android student app: /api/student/{id}/... (section 11) ---------------

student_app_router = APIRouter(prefix="/api/student", tags=["student-app"])


@student_app_router.get("/{student_id}", response_model=StudentResponse)
async def get_student_app_profile(
    student_id: uuid.UUID, db: AsyncSession = Depends(get_db)
) -> StudentResponse:
    student = await _get_student_or_404(db, student_id)
    return StudentResponse.model_validate(student)


@student_app_router.get("/{student_id}/lessons")
async def get_student_lessons(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    lesson_service: LessonService = Depends(get_lesson_service),
):
    student = await _get_student_or_404(db, student_id)
    lessons = await lesson_service.list_for_student(db, student.class_id)
    return [
        {
            "id": lesson.id,
            "title": lesson.topic,
            "subject": lesson.subject,
            "mother_tongue_script": lesson.mother_tongue_script,
            "activity": lesson.activity,
        }
        for lesson in lessons
    ]


@student_app_router.get("/{student_id}/quizzes", response_model=list[QuizStudentResponse])
async def get_student_quizzes(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> list[QuizStudentResponse]:
    student = await _get_student_or_404(db, student_id)
    if student.class_id is None:
        return []
    quizzes = await quiz_service.list_for_class(db, student.class_id)
    return [QuizStudentResponse.model_validate(q) for q in quizzes]


@student_app_router.post("/{student_id}/quiz-result", response_model=QuizAttemptResponse)
async def submit_student_quiz_result(
    student_id: uuid.UUID,
    quiz_id: uuid.UUID,
    answers: QuizAttemptRequest,
    db: AsyncSession = Depends(get_db),
    quiz_service: QuizService = Depends(get_quiz_service),
) -> QuizAttemptResponse:
    await _get_student_or_404(db, student_id)
    answers.student_id = student_id
    attempt = await quiz_service.submit_attempt(db, quiz_id, answers)
    return QuizAttemptResponse.model_validate(attempt)


@student_app_router.post("/{student_id}/progress", response_model=StudentProgressEventResponse)
async def record_student_app_progress(
    student_id: uuid.UUID,
    request: StudentProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
) -> StudentProgressEventResponse:
    return await record_student_progress(student_id, request, db)


@student_app_router.post("/{student_id}/viva", response_model=VivaStartResponse)
async def start_student_viva(
    student_id: uuid.UUID,
    request: VivaStartRequest,
    db: AsyncSession = Depends(get_db),
    viva_service: VivaService = Depends(get_viva_service),
) -> VivaStartResponse:
    request.student_id = student_id
    session = await viva_service.start(db, request)
    first_question = session.questions[0]
    return VivaStartResponse(
        id=session.id,
        student_id=session.student_id,
        subject=session.subject,
        topic=session.topic,
        language=session.language,
        num_questions=session.num_questions,
        status=session.status,
        first_question=VivaQuestionResponse.model_validate(first_question),
    )


@student_app_router.post("/{student_id}/sync", response_model=SyncResponse)
async def sync_student_events(
    student_id: uuid.UUID,
    events: list[SyncEventIn],
    db: AsyncSession = Depends(get_db),
    sync_service: SyncService = Depends(get_sync_service),
) -> SyncResponse:
    await _get_student_or_404(db, student_id)
    processed, failed = await sync_service.process_events(db, student_id, events)
    return SyncResponse(processed=processed, failed=failed)
