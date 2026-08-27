import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.viva import (
    VivaAnswerRequest,
    VivaAnswerResponse,
    VivaQuestionResponse,
    VivaReportResponse,
    VivaStartRequest,
    VivaStartResponse,
)
from app.services.viva_service import VivaService, get_viva_service

router = APIRouter(prefix="/api/viva", tags=["viva"])


@router.post("/start", response_model=VivaStartResponse)
async def start_viva(
    request: VivaStartRequest,
    db: AsyncSession = Depends(get_db),
    service: VivaService = Depends(get_viva_service),
) -> VivaStartResponse:
    session = await service.start(db, request)
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


@router.post("/{viva_id}/answer", response_model=VivaAnswerResponse)
async def answer_viva_question(
    viva_id: uuid.UUID,
    request: VivaAnswerRequest,
    db: AsyncSession = Depends(get_db),
    service: VivaService = Depends(get_viva_service),
) -> VivaAnswerResponse:
    answer, next_question, is_last = await service.submit_answer(db, viva_id, request)
    return VivaAnswerResponse(
        correct=answer.correct,
        score=answer.score,
        confidence=answer.confidence,
        feedback=answer.feedback,
        competency=None,
        next_question=VivaQuestionResponse.model_validate(next_question) if next_question else None,
        is_last_question=is_last,
    )


@router.post("/{viva_id}/complete", response_model=VivaReportResponse)
async def complete_viva(
    viva_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    service: VivaService = Depends(get_viva_service),
) -> VivaReportResponse:
    session = await service.complete(db, viva_id)
    return VivaReportResponse(
        id=session.id,
        student_id=session.student_id,
        score=session.score or 0,
        total=session.total or 0,
        strengths=session.strengths or [],
        weaknesses=session.weaknesses or [],
        recommended_interventions=session.recommended_interventions or [],
        completed_at=session.completed_at,
    )
