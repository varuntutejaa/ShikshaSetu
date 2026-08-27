"""Quiz generation pipeline: lesson -> LLM -> structured quiz -> translate -> save."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import NotFoundError
from app.models.lesson import Lesson
from app.models.progress import StudentProgress
from app.models.quiz import Quiz, QuizAttempt, QuizQuestion
from app.models.student import Student
from app.schemas.quiz import QuizAttemptRequest, QuizGenerateRequest
from app.services.llm_service import LLMService, get_llm_service
from app.services.translation_service import TranslationService, get_translation_service

BASE_GENERATION_LANGUAGE = "hi"


class QuizService:
    def __init__(
        self, llm: LLMService | None = None, translator: TranslationService | None = None
    ) -> None:
        self._llm = llm or get_llm_service()
        self._translator = translator or get_translation_service()

    async def generate(self, db: AsyncSession, request: QuizGenerateRequest) -> Quiz:
        lesson = await db.get(Lesson, request.lesson_id)
        if lesson is None:
            raise NotFoundError(f"Lesson {request.lesson_id} not found")

        raw_questions = await self._llm.generate_quiz(
            grade=lesson.grade,
            subject=lesson.subject,
            topic=lesson.topic,
            number_of_questions=request.number_of_questions,
            types=[t.value for t in request.types],
            difficulty=request.difficulty.value,
        )

        needs_translation = request.language != BASE_GENERATION_LANGUAGE
        quiz = Quiz(lesson_id=lesson.id, title=f"{lesson.topic} Quiz", language=request.language)
        db.add(quiz)
        await db.flush()

        for index, raw in enumerate(raw_questions):
            question_text = raw["question"]
            options = raw.get("options")
            correct_answer = raw["correct_answer"]

            if needs_translation:
                question_text = (
                    await self._translator.translate(question_text, BASE_GENERATION_LANGUAGE, request.language)
                )["translated_text"]
                if options:
                    options = [
                        (await self._translator.translate(o, BASE_GENERATION_LANGUAGE, request.language))[
                            "translated_text"
                        ]
                        for o in options
                    ]
                correct_answer = (
                    await self._translator.translate(correct_answer, BASE_GENERATION_LANGUAGE, request.language)
                )["translated_text"]

            db.add(
                QuizQuestion(
                    quiz_id=quiz.id,
                    order_index=index,
                    question=question_text,
                    options=options,
                    correct_answer=correct_answer,
                    question_type=raw["question_type"],
                    difficulty=raw["difficulty"],
                    competency=raw["competency"],
                    explanation=raw.get("explanation"),
                )
            )

        await db.commit()
        return await self.get(db, quiz.id)

    async def get(self, db: AsyncSession, quiz_id: uuid.UUID) -> Quiz:
        stmt = select(Quiz).where(Quiz.id == quiz_id).options(selectinload(Quiz.questions))
        result = await db.execute(stmt)
        quiz = result.scalar_one_or_none()
        if quiz is None:
            raise NotFoundError(f"Quiz {quiz_id} not found")
        return quiz

    async def list_for_class(self, db: AsyncSession, class_id: uuid.UUID) -> list[Quiz]:
        stmt = (
            select(Quiz)
            .join(Lesson, Quiz.lesson_id == Lesson.id)
            .where(Lesson.class_id == class_id)
            .options(selectinload(Quiz.questions))
            .order_by(Quiz.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().unique().all())

    async def submit_attempt(
        self, db: AsyncSession, quiz_id: uuid.UUID, request: QuizAttemptRequest
    ) -> QuizAttempt:
        quiz = await self.get(db, quiz_id)
        student = await db.get(Student, request.student_id)
        if student is None:
            raise NotFoundError(f"Student {request.student_id} not found")

        questions_by_id = {q.id: q for q in quiz.questions}
        graded_answers = []
        score = 0
        for submission in request.answers:
            question = questions_by_id.get(submission.question_id)
            if question is None:
                continue
            is_correct = (
                submission.student_answer.strip().lower() == question.correct_answer.strip().lower()
            )
            if is_correct:
                score += 1
            graded_answers.append(
                {
                    "question_id": str(submission.question_id),
                    "student_answer": submission.student_answer,
                    "correct": is_correct,
                }
            )

        total = len(quiz.questions)
        attempt = QuizAttempt(
            quiz_id=quiz.id,
            student_id=student.id,
            score=score,
            total=total,
            answers=graded_answers,
            completed_at=datetime.now(timezone.utc),
        )
        db.add(attempt)

        db.add(
            StudentProgress(
                student_id=student.id,
                event_type="quiz_completed",
                score=round((score / total) * 100, 1) if total else 0,
                extra_data={"quiz_id": str(quiz.id), "score": score, "total": total},
            )
        )

        if total:
            percentage = (score / total) * 100
            student.numeracy_score = round((student.numeracy_score * 0.7) + (percentage * 0.3), 1)
            student.recompute_overall()

        await db.commit()
        await db.refresh(attempt)
        return attempt


quiz_service = QuizService()


def get_quiz_service() -> QuizService:
    return quiz_service
