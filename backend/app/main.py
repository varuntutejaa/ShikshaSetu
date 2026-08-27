import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import health, lessons, quizzes, speech, students, sync, translation, viva
from app.api.websocket import classroom, student
from app.core.config import settings
from app.core.database import AsyncSessionLocal, dispose_engine, init_models
from app.core.exceptions import AppError
from app.core.storage import MEDIA_ROOT
from app.services.demo_seed import ensure_demo_data
from app.services.sarvam_service import get_sarvam_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("shikshasetu")

PUBLIC_WEB_ORIGINS = [
    "https://shikshasetu-teacher.onrender.com",
    "https://shikshasetu-sigma.vercel.app",
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting %s (environment=%s, mock_mode=%s)",
        settings.service_name,
        settings.environment,
        settings.mock_mode,
    )
    await init_models()
    if settings.mock_mode:
        async with AsyncSessionLocal() as db:
            await ensure_demo_data(db)
    yield
    await get_sarvam_service().aclose()
    await dispose_engine()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.service_name,
    version=settings.version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    # Explicit origins only; no wildcard in dev or prod.
    allow_origins=list(dict.fromkeys([*settings.cors_origin_list, *PUBLIC_WEB_ORIGINS])),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/media", StaticFiles(directory=str(MEDIA_ROOT)), name="media")


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for err in exc.errors():
        field = ".".join(str(p) for p in err["loc"] if p not in ("body", "query", "path"))
        details.append(f"{field}: {err['msg']}" if field else err["msg"])
    return JSONResponse(
        status_code=422,
        content={"error": {"code": "VALIDATION_ERROR", "message": "; ".join(details)}},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred."}},
    )


app.include_router(health.router)
app.include_router(translation.router)
app.include_router(speech.router)
app.include_router(lessons.router)
app.include_router(quizzes.router)
app.include_router(viva.router)
app.include_router(students.router)
app.include_router(students.student_app_router)
app.include_router(sync.router)
app.include_router(classroom.router)
app.include_router(student.router)
