from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import extract_bearer_token, get_current_student
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import UnauthorizedError
from app.models.student import Student
from app.schemas.auth import StudentAuthResponse, StudentLoginRequest, StudentRegisterRequest
from app.schemas.student import StudentResponse
from app.services import auth_service

router = APIRouter(prefix="/api/auth/student", tags=["auth"])


def _require_admin_key(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")) -> None:
    """No-op when ADMIN_API_KEY isn't configured (open registration — fine
    for local/demo use). See app/core/config.py."""
    if settings.admin_api_key and x_admin_key != settings.admin_api_key:
        raise UnauthorizedError("Invalid or missing admin key")


@router.post(
    "/register",
    response_model=StudentAuthResponse,
    dependencies=[Depends(_require_admin_key)],
)
async def register(payload: StudentRegisterRequest, db: AsyncSession = Depends(get_db)) -> StudentAuthResponse:
    """Demo/admin-only student creation. Logs the new student in immediately
    so the Android app can move straight from "create" to "use"."""
    student = await auth_service.register_student(db, payload)
    token, session = await auth_service.create_session(db, student)
    return StudentAuthResponse(
        token=token, expires_at=session.expires_at, student=StudentResponse.model_validate(student)
    )


@router.post("/login", response_model=StudentAuthResponse)
async def login(payload: StudentLoginRequest, db: AsyncSession = Depends(get_db)) -> StudentAuthResponse:
    student = await auth_service.authenticate_student(db, payload.student_id, payload.password)
    token, session = await auth_service.create_session(db, student)
    return StudentAuthResponse(
        token=token, expires_at=session.expires_at, student=StudentResponse.model_validate(student)
    )


@router.post("/logout", status_code=204)
async def logout(
    authorization: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> None:
    token = extract_bearer_token(authorization)
    if token is not None:
        await auth_service.revoke_session(db, token)


@router.get("/me", response_model=StudentResponse)
async def me(current: Student = Depends(get_current_student)) -> StudentResponse:
    return StudentResponse.model_validate(current)
