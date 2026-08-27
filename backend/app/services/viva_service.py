"""AI Viva: the AI independently asks questions, evaluates spoken answers,
and produces a learning-gap report — no teacher/translation loop involved.

AI generates question -> TTS -> student -> speaks -> STT -> LLM semantic
evaluation -> score -> next question -> ... -> report.
"""

import uuid
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError, ValidationAppError
from app.models.progress import StudentProgress
from app.models.student import Student
from app.models.viva import VivaAnswer, VivaQuestion, VivaSession
from app.schemas.viva import VivaAnswerRequest, VivaStartRequest
from app.services.llm_service import LLMService, get_llm_service

INTERVENTION_TEMPLATES = {
    "default": "Practice {competency} using physical objects and visual counting.",
}


class VivaService:
    def __init__(self, llm: LLMService | None = None) -> None:
        self._llm = llm or get_llm_service()

    async def start(self, db: AsyncSession, request: VivaStartRequest) -> VivaSession:
        student = await db.get(Student, request.student_id)
        if student is None:
            raise NotFoundError(f"Student {request.student_id} not found")

        session = VivaSession(
            student_id=student.id,
            lesson_id=request.lesson_id,
            subject=request.subject,
            topic=request.topic,
            language=request.language,
            num_questions=request.number_of_questions,
            status="in_progress",
        )
        db.add(session)
        await db.flush()

        first = await self._llm.generate_viva_question(
            subject=request.subject, topic=request.topic, grade=student.grade, question_number=1
        )
        question = VivaQuestion(
            viva_session_id=session.id,
            order_index=0,
            question=first["question"],
            competency=first.get("competency"),
        )
        db.add(question)
        await db.commit()

        return await self.get(db, session.id)

    async def get(self, db: AsyncSession, viva_id: uuid.UUID) -> VivaSession:
        stmt = (
            select(VivaSession)
            .where(VivaSession.id == viva_id)
            .options(selectinload(VivaSession.questions).selectinload(VivaQuestion.answer))
        )
        result = await db.execute(stmt)
        session = result.scalar_one_or_none()
        if session is None:
            raise NotFoundError(f"Viva session {viva_id} not found")
        return session

    async def submit_answer(
        self, db: AsyncSession, viva_id: uuid.UUID, request: VivaAnswerRequest
    ) -> tuple[VivaAnswer, VivaQuestion | None, bool]:
        session = await self.get(db, viva_id)
        question = next((q for q in session.questions if q.id == request.question_id), None)
        if question is None:
            raise NotFoundError(f"Question {request.question_id} not found in this viva session")
        if question.answer is not None:
            raise ValidationAppError("This question has already been answered")

        evaluation = await self._llm.evaluate_viva_answer(
            question=question.question,
            student_answer_text=request.student_answer_text,
            competency=question.competency,
        )
        answer = VivaAnswer(
            viva_question_id=question.id,
            student_answer_text=request.student_answer_text,
            correct=evaluation["correct"],
            score=evaluation["score"],
            confidence=evaluation["confidence"],
            feedback=evaluation["feedback"],
        )
        db.add(answer)
        await db.flush()

        answered_count = sum(1 for q in session.questions if q.answer is not None) + 1
        is_last = answered_count >= session.num_questions

        next_question = None
        if not is_last:
            student = await db.get(Student, session.student_id)
            draft = await self._llm.generate_viva_question(
                subject=session.subject,
                topic=session.topic,
                grade=student.grade if student else 2,
                question_number=answered_count + 1,
            )
            next_question = VivaQuestion(
                viva_session_id=session.id,
                order_index=answered_count,
                question=draft["question"],
                competency=draft.get("competency"),
            )
            db.add(next_question)

        await db.commit()
        return answer, next_question, is_last

    async def complete(self, db: AsyncSession, viva_id: uuid.UUID) -> VivaSession:
        session = await self.get(db, viva_id)
        answered = [q for q in session.questions if q.answer is not None]

        score = sum(1 for q in answered if q.answer.correct)
        total = len(answered)

        by_competency: dict[str, list[bool]] = defaultdict(list)
        for q in answered:
            by_competency[q.competency or "General"].append(q.answer.correct)

        strengths = [c for c, results in by_competency.items() if results.count(True) == len(results)]
        weaknesses = [
            c for c, results in by_competency.items() if results.count(True) / len(results) < 0.6
        ]
        interventions = [
            INTERVENTION_TEMPLATES["default"].format(competency=c) for c in weaknesses
        ] or ["Continue regular practice — no significant learning gaps detected."]

        session.score = score
        session.total = total
        session.strengths = strengths
        session.weaknesses = weaknesses
        session.recommended_interventions = interventions
        session.status = "completed"
        session.completed_at = datetime.now(timezone.utc)

        student = await db.get(Student, session.student_id)
        if student and total:
            percentage = (score / total) * 100
            if "math" in session.subject.lower() or "numer" in session.subject.lower():
                student.numeracy_score = round((student.numeracy_score * 0.7) + (percentage * 0.3), 1)
            else:
                student.reading_score = round((student.reading_score * 0.7) + (percentage * 0.3), 1)
            student.recompute_overall()

            db.add(
                StudentProgress(
                    student_id=student.id,
                    event_type="viva_completed",
                    score=percentage,
                    extra_data={"viva_id": str(session.id), "score": score, "total": total},
                )
            )

        await db.commit()
        return await self.get(db, session.id)


viva_service = VivaService()


def get_viva_service() -> VivaService:
    return viva_service
