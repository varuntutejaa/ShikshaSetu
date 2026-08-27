"""Lesson generation pipeline: LLM curriculum draft -> translation -> persist.

Hindi curriculum/topic -> LLM -> structured lesson (Hindi) -> translation ->
mother-tongue script -> save -> return lesson.
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.core.storage import save_audio_file
from app.models.lesson import Lesson, LessonContent
from app.schemas.lesson import LessonGenerateRequest
from app.services.llm_service import LLMService, get_llm_service
from app.services.sarvam_service import SarvamService, get_sarvam_service
from app.services.translation_service import TranslationService, get_translation_service


class LessonService:
    def __init__(
        self,
        llm: LLMService | None = None,
        translator: TranslationService | None = None,
        sarvam: SarvamService | None = None,
    ) -> None:
        self._llm = llm or get_llm_service()
        self._translator = translator or get_translation_service()
        self._sarvam = sarvam or get_sarvam_service()

    async def generate(self, db: AsyncSession, request: LessonGenerateRequest) -> Lesson:
        draft = await self._llm.generate_lesson(
            grade=request.grade,
            subject=request.subject,
            topic=request.topic,
            description=request.description,
        )

        teacher_script = draft["teacher_script"]
        translation = await self._translator.translate(
            teacher_script, request.teacher_language, request.student_language
        )

        lesson = Lesson(
            teacher_id=request.teacher_id,
            class_id=request.class_id,
            grade=request.grade,
            subject=request.subject,
            topic=request.topic,
            teacher_language=request.teacher_language,
            student_language=request.student_language,
            learning_objectives=draft.get("learning_objectives", []),
            teacher_script=teacher_script,
            mother_tongue_script=translation["translated_text"],
            activity=draft.get("activity", ""),
            assessment_topics=draft.get("assessment_topics", []),
        )
        db.add(lesson)
        await db.commit()
        await db.refresh(lesson)
        return lesson

    async def get(self, db: AsyncSession, lesson_id: uuid.UUID) -> Lesson:
        lesson = await db.get(Lesson, lesson_id)
        if lesson is None:
            raise NotFoundError(f"Lesson {lesson_id} not found")
        return lesson

    async def list_for_student(self, db: AsyncSession, class_id: uuid.UUID | None) -> list[Lesson]:
        stmt = select(Lesson)
        if class_id is not None:
            stmt = stmt.where(Lesson.class_id == class_id)
        stmt = stmt.order_by(Lesson.created_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def generate_audio(
        self, db: AsyncSession, lesson_id: uuid.UUID, script: str, language: str
    ) -> LessonContent:
        lesson = await self.get(db, lesson_id)
        text = lesson.mother_tongue_script if script == "mother_tongue" else lesson.teacher_script

        tts_result = await self._sarvam.text_to_speech(text, language)
        audio_url = save_audio_file(tts_result["audio_bytes"], prefix=f"lesson-{lesson_id}")

        content = LessonContent(
            lesson_id=lesson.id,
            content_type="audio",
            language=language,
            audio_url=audio_url,
        )
        db.add(content)
        await db.commit()
        await db.refresh(content)
        return content

    async def generate_worksheet(
        self, db: AsyncSession, lesson_id: uuid.UUID, language: str
    ) -> LessonContent:
        lesson = await self.get(db, lesson_id)
        objectives_list = "\n".join(f"- {o}" for o in lesson.learning_objectives)
        worksheet_text = (
            f"Worksheet: {lesson.topic}\n\n"
            f"Learning Objectives:\n{objectives_list}\n\n"
            f"Activity:\n{lesson.activity}\n"
        )
        content = LessonContent(
            lesson_id=lesson.id,
            content_type="worksheet",
            language=language,
            text_content=worksheet_text,
        )
        db.add(content)
        await db.commit()
        await db.refresh(content)
        return content


lesson_service = LessonService()


def get_lesson_service() -> LessonService:
    return lesson_service
