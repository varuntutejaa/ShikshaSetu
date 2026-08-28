"""Class session lifecycle — the shared handle both the video room name and
the audio WebSocket key off. Creating/ending a session is pure metadata;
it never touches either media pipeline directly.
"""

import uuid
from datetime import datetime, timezone
from secrets import choice

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession as DbSession

from app.core.exceptions import NotFoundError
from app.models.class_model import ClassModel
from app.models.classroom import ClassSession, ClassSessionParticipant
from app.models.student import Student
from app.schemas.classroom import ClassCreateRequest, ClassJoinRequest, ClassSessionCreateRequest

CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class ClassroomService:
    async def _generate_class_code(self, db: DbSession) -> str:
        for _ in range(20):
            code = "".join(choice(CODE_ALPHABET) for _ in range(6))
            result = await db.execute(select(ClassModel.id).where(ClassModel.class_code == code))
            if result.scalar_one_or_none() is None:
                return code
        raise RuntimeError("Could not generate a unique class code")

    async def create_class(self, db: DbSession, request: ClassCreateRequest) -> ClassModel:
        classroom = ClassModel(
            teacher_id=request.teacher_id,
            name=request.name,
            class_code=await self._generate_class_code(db),
            grade=request.grade,
            section=request.section,
            subject_focus=request.subject_focus,
            teacher_language=request.teacher_language,
            student_language=request.student_language,
        )
        db.add(classroom)
        await db.commit()
        await db.refresh(classroom)
        return classroom

    async def join_class(self, db: DbSession, request: ClassJoinRequest) -> tuple[ClassModel, ClassSession | None]:
        code = request.class_code.strip().upper()
        result = await db.execute(select(ClassModel).where(ClassModel.class_code == code))
        classroom = result.scalar_one_or_none()
        if classroom is None:
            raise NotFoundError(f"Class code {code} not found")

        if request.student_id is not None:
            student = await db.get(Student, request.student_id)
            if student is None:
                raise NotFoundError(f"Student {request.student_id} not found")
            student.class_id = classroom.id

        active = await self.get_active_session_for_class(db, classroom.id, required=False)
        await db.commit()
        return classroom, active

    async def create_session(self, db: DbSession, request: ClassSessionCreateRequest) -> ClassSession:
        session = ClassSession(
            teacher_id=request.teacher_id,
            class_id=request.class_id,
            teacher_language=request.teacher_language,
            student_language=request.student_language,
            status="active",
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    async def start_class(self, db: DbSession, class_id: uuid.UUID) -> ClassSession:
        classroom = await db.get(ClassModel, class_id)
        if classroom is None:
            raise NotFoundError(f"Class {class_id} not found")
        active = await self.get_active_session_for_class(db, class_id, required=False)
        if active is not None:
            return active
        return await self.create_session(
            db,
            ClassSessionCreateRequest(
                teacher_id=classroom.teacher_id,
                class_id=classroom.id,
                teacher_language=classroom.teacher_language,
                student_language=classroom.student_language,
            ),
        )

    async def get_session(self, db: DbSession, session_id: uuid.UUID) -> ClassSession:
        session = await db.get(ClassSession, session_id)
        if session is None:
            raise NotFoundError(f"Class session {session_id} not found")
        return session

    async def end_session(self, db: DbSession, session_id: uuid.UUID) -> ClassSession:
        session = await self.get_session(db, session_id)
        session.status = "ended"
        session.ended_at = datetime.now(timezone.utc)
        result = await db.execute(
            select(ClassSessionParticipant).where(
                ClassSessionParticipant.session_id == session_id,
                ClassSessionParticipant.status == "online",
            )
        )
        for participant in result.scalars().all():
            participant.status = "offline"
            participant.left_at = session.ended_at
        await db.commit()
        await db.refresh(session)
        return session

    async def get_active_session_for_class(
        self, db: DbSession, class_id: uuid.UUID, required: bool = True
    ) -> ClassSession | None:
        result = await db.execute(
            select(ClassSession)
            .where(ClassSession.class_id == class_id, ClassSession.status == "active")
            .order_by(ClassSession.created_at.desc())
            .limit(1)
        )
        session = result.scalar_one_or_none()
        if session is None and required:
            raise NotFoundError(f"No active session for class {class_id}")
        return session

    async def list_sessions(self, db: DbSession, class_id: uuid.UUID | None, status: str | None) -> list[ClassSession]:
        stmt = select(ClassSession)
        if class_id is not None:
            stmt = stmt.where(ClassSession.class_id == class_id)
        if status is not None:
            stmt = stmt.where(ClassSession.status == status)
        result = await db.execute(stmt.order_by(ClassSession.created_at.desc()))
        return list(result.scalars().all())

    async def record_presence(
        self,
        db: DbSession,
        session_id: uuid.UUID,
        participant_type: str,
        display_name: str,
        student_id: uuid.UUID | None,
        online: bool,
    ) -> ClassSessionParticipant:
        await self.get_session(db, session_id)
        now = datetime.now(timezone.utc)
        participant = ClassSessionParticipant(
            session_id=session_id,
            student_id=student_id,
            participant_type=participant_type,
            display_name=display_name,
            status="online" if online else "offline",
            joined_at=now,
            left_at=None if online else now,
        )
        db.add(participant)
        await db.commit()
        await db.refresh(participant)
        return participant

    async def list_participants(self, db: DbSession, session_id: uuid.UUID) -> list[ClassSessionParticipant]:
        await self.get_session(db, session_id)
        result = await db.execute(
            select(ClassSessionParticipant)
            .where(ClassSessionParticipant.session_id == session_id)
            .order_by(ClassSessionParticipant.joined_at.desc())
        )
        return list(result.scalars().all())

    async def set_session_content(
        self, db: DbSession, session_id: uuid.UUID, lesson_id: uuid.UUID | None, slide_index: int
    ) -> ClassSession:
        session = await self.get_session(db, session_id)
        session.lesson_id = lesson_id
        session.current_slide_index = slide_index
        await db.commit()
        await db.refresh(session)
        return session


classroom_service = ClassroomService()


def get_classroom_service() -> ClassroomService:
    return classroom_service
