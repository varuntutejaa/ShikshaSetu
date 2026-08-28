"""Student login/registration and session lifecycle.

Session tokens are opaque, server-issued, and stored (hashed) in
`student_sessions` so logout can genuinely revoke access — see
app/core/security.py for the hashing details.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    SESSION_TTL_DAYS,
    generate_session_token,
    hash_password,
    hash_token,
    verify_password,
)
from app.models.student import Student
from app.models.student_session import StudentSession
from app.schemas.auth import StudentRegisterRequest


async def get_student_by_code(db: AsyncSession, student_code: str) -> Student | None:
    stmt = select(Student).where(Student.student_code == student_code)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def register_student(db: AsyncSession, payload: StudentRegisterRequest) -> Student:
    if await get_student_by_code(db, payload.student_id) is not None:
        raise ConflictError(f"Student ID '{payload.student_id}' is already taken")

    student = Student(
        name=payload.name,
        student_code=payload.student_id,
        password_hash=hash_password(payload.password),
        grade=payload.grade,
        mother_tongue=payload.mother_tongue,
        school=payload.school,
        class_id=payload.class_id,
        # Explicit, not relying on the column defaults: those only apply at
        # flush time, and recompute_overall() below needs real floats now.
        attendance=0.0,
        reading_score=0.0,
        numeracy_score=0.0,
        vocabulary_score=0.0,
    )
    student.recompute_overall()
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


async def authenticate_student(db: AsyncSession, student_id: str, password: str) -> Student:
    student = await get_student_by_code(db, student_id)
    # Deliberately identical error for "no such ID" and "wrong password" —
    # never let a client enumerate which student IDs exist.
    if student is None or student.password_hash is None or not verify_password(password, student.password_hash):
        raise UnauthorizedError("Invalid student ID or password")
    return student


async def create_session(db: AsyncSession, student: Student) -> tuple[str, StudentSession]:
    token = generate_session_token()
    session = StudentSession(
        student_id=student.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return token, session


async def revoke_session(db: AsyncSession, token: str) -> None:
    stmt = select(StudentSession).where(StudentSession.token_hash == hash_token(token))
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if session is not None and session.revoked_at is None:
        session.revoked_at = datetime.now(timezone.utc)
        await db.commit()


async def get_student_for_token(db: AsyncSession, token: str) -> Student | None:
    stmt = select(StudentSession).where(StudentSession.token_hash == hash_token(token))
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if session is None or session.revoked_at is not None:
        return None

    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None

    return await db.get(Student, session.student_id)
