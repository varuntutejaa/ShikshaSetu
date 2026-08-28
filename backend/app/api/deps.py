"""Cross-cutting FastAPI dependencies shared across route modules."""

from fastapi import Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.models.student import Student
from app.services.auth_service import get_student_for_token


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization.split(" ", 1)[1].strip() or None


async def get_current_student(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> Student:
    """Resolves the bearer token in `Authorization: Bearer <token>` to the
    logged-in student, or raises 401. Used to protect the Android-facing
    /api/student/{student_id}/... routes."""

    token = extract_bearer_token(authorization)
    if token is None:
        raise UnauthorizedError("Missing or invalid Authorization header")

    student = await get_student_for_token(db, token)
    if student is None:
        raise UnauthorizedError("Session expired or invalid — please log in again")
    return student
