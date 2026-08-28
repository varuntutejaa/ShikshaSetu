"""Class session + LiveKit token endpoints.

This router handles ONLY metadata and signaling — session lifecycle and
short-lived video tokens. It never receives, forwards, or stores a video
frame; that's LiveKit's job entirely, reached directly by the browser/app
using the token this issues. The AI audio pipeline lives on its own
WebSocket (app/api/websocket/classroom.py) and is untouched by this router.
"""

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.classroom import (
    ClassCreateRequest,
    ClassJoinRequest,
    ClassJoinResponse,
    ClassResponse,
    ClassSessionCreateRequest,
    ClassSessionResponse,
    ParticipantResponse,
    SessionContentRequest,
    SessionContentResponse,
    LiveKitTokenRequest,
    LiveKitTokenResponse,
)
from app.services.classroom_service import ClassroomService, get_classroom_service
from app.services.livekit_service import LiveKitService, get_livekit_service
from app.services.lesson_service import LessonService, get_lesson_service
from sqlalchemy import func, select
from app.models.class_model import ClassModel
from app.models.classroom import ClassSession, ClassSessionParticipant
from app.models.lesson import Lesson
from app.models.progress import StudentProgress

router = APIRouter(prefix="/api/classroom", tags=["classroom"])


@router.post("/classes", response_model=ClassResponse)
async def create_class(
    request: ClassCreateRequest,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassResponse:
    classroom = await service.create_class(db, request)
    return ClassResponse.model_validate(classroom)


@router.post("/classes/join", response_model=ClassJoinResponse)
async def join_class(
    request: ClassJoinRequest,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassJoinResponse:
    classroom, active_session = await service.join_class(db, request)
    return ClassJoinResponse(
        classroom=ClassResponse.model_validate(classroom),
        active_session=ClassSessionResponse.model_validate(active_session) if active_session else None,
    )


@router.post("/classes/{class_id}/start", response_model=ClassSessionResponse)
async def start_class(
    class_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassSessionResponse:
    session = await service.start_class(db, class_id)
    return ClassSessionResponse.model_validate(session)


@router.get("/sessions", response_model=list[ClassSessionResponse])
async def list_sessions(
    class_id: uuid.UUID | None = None,
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> list[ClassSessionResponse]:
    sessions = await service.list_sessions(db, class_id, status)
    return [ClassSessionResponse.model_validate(session) for session in sessions]


@router.get("/session/{session_id}/participants", response_model=list[ParticipantResponse])
async def list_participants(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> list[ParticipantResponse]:
    participants = await service.list_participants(db, session_id)
    return [ParticipantResponse.model_validate(participant) for participant in participants]


@router.post("/session/{session_id}/content", response_model=SessionContentResponse)
async def set_session_content(
    session_id: uuid.UUID,
    request: SessionContentRequest,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
    lessons: LessonService = Depends(get_lesson_service),
) -> SessionContentResponse:
    session = await service.set_session_content(db, session_id, request.lesson_id, request.slide_index)
    pack = await lessons.offline_pack(db, request.lesson_id) if request.lesson_id else None
    return SessionContentResponse(
        session_id=session.id,
        lesson_id=session.lesson_id,
        current_slide_index=session.current_slide_index,
        offline_pack=pack,
    )


@router.post("/session", response_model=ClassSessionResponse)
async def create_session(
    request: ClassSessionCreateRequest,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassSessionResponse:
    session = await service.create_session(db, request)
    return ClassSessionResponse.model_validate(session)


@router.get("/session/{session_id}", response_model=ClassSessionResponse)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassSessionResponse:
    session = await service.get_session(db, session_id)
    return ClassSessionResponse.model_validate(session)


@router.post("/session/{session_id}/end", response_model=ClassSessionResponse)
async def end_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: ClassroomService = Depends(get_classroom_service),
) -> ClassSessionResponse:
    session = await service.end_session(db, session_id)
    return ClassSessionResponse.model_validate(session)


@router.post("/livekit-token", response_model=LiveKitTokenResponse)
async def create_livekit_token(
    request: LiveKitTokenRequest,
    db: AsyncSession = Depends(get_db),
    classroom: ClassroomService = Depends(get_classroom_service),
    livekit: LiveKitService = Depends(get_livekit_service),
) -> LiveKitTokenResponse:
    # Confirms the session is real before minting a room token — the video
    # room's lifetime is scoped to a genuine class session either way.
    await classroom.get_session(db, request.session_id)

    identity = request.identity or f"{request.participant_type.value}-{uuid.uuid4().hex[:8]}"
    token, url, room = livekit.generate_token(
        session_id=str(request.session_id),
        participant_type=request.participant_type,
        identity=identity,
        display_name=request.participant_type.value.capitalize(),
    )
    return LiveKitTokenResponse(token=token, url=url, room=room)


@router.get("/metrics")
async def classroom_metrics(
    class_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
) -> dict:
    lesson_stmt = select(func.count(Lesson.id))
    session_stmt = select(func.count(ClassSession.id))
    participant_stmt = select(func.count(ClassSessionParticipant.id))
    progress_stmt = select(StudentProgress)
    if class_id:
        lesson_stmt = lesson_stmt.where(Lesson.class_id == class_id)
        session_stmt = session_stmt.where(ClassSession.class_id == class_id)
        participant_stmt = participant_stmt.join(ClassSession).where(ClassSession.class_id == class_id)
    lessons_completed = (await db.execute(lesson_stmt)).scalar_one()
    sessions_count = (await db.execute(session_stmt)).scalar_one()
    participation_events = (await db.execute(participant_stmt)).scalar_one()
    progress_events = list((await db.execute(progress_stmt)).scalars().all())
    scored = [p.score for p in progress_events if p.score is not None]
    mother_tongue_lessons = (
        await db.execute(select(func.count(Lesson.id)).where(Lesson.student_language != Lesson.teacher_language))
    ).scalar_one()
    return {
        "source": "persistent_data",
        "demo_data": False,
        "lessons_completed": lessons_completed,
        "live_classes": sessions_count,
        "student_participation_events": participation_events,
        "mother_tongue_usage": mother_tongue_lessons,
        "average_assessment_score": round(sum(scored) / len(scored), 1) if scored else None,
        "weak_concepts_resolved": None,
        "pre_post_assessment_improvement": None,
        "notes": "Improvement metrics require baseline/post assessment pairs in production data.",
    }
