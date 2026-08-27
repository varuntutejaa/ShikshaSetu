"""Test configuration.

Forces mock mode and a throwaway SQLite database *before* any `app.*` module
is imported, so the full test suite runs with zero external dependencies —
no Postgres, no Sarvam/LLM credits. `app.core.database.engine` is created at
import time from `DATABASE_URL`, so these env vars must be set first.
"""

import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).resolve().parent / "test_shikshasetu.db"
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ["MOCK_MODE"] = "true"
os.environ["LLM_PROVIDER"] = "mock"
os.environ["SARVAM_API_KEY"] = ""
os.environ["LLM_API_KEY"] = ""
os.environ["CORS_ORIGINS"] = "http://localhost:3000"
os.environ["ENVIRONMENT"] = "test"

import pytest_asyncio  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

import app.models  # noqa: E402, F401 — registers all models on Base.metadata
from app.core.database import AsyncSessionLocal, Base, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402


@pytest_asyncio.fixture(autouse=True)
async def _clean_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=fastapi_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def db_session():
    async with AsyncSessionLocal() as session:
        yield session
