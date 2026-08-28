"""Verify ShikshaSetu FastAPI flows against the configured Supabase Postgres.

Run with a server-side DATABASE_URL, for example:

    DATABASE_URL='postgresql+asyncpg://...' MOCK_MODE=true \
      python scripts/verify_supabase_database.py

The script never prints DATABASE_URL or credentials.
"""

from __future__ import annotations

import asyncio
import uuid

from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import inspect, text

import app.models  # noqa: F401
from app.core.database import Base, AsyncSessionLocal, engine
from app.main import app
from app.services.demo_seed import ensure_demo_data


async def _verify_tables() -> list[str]:
    async with engine.begin() as conn:
        await conn.execute(text("select 1"))
        table_names = await conn.run_sync(lambda sync_conn: set(inspect(sync_conn).get_table_names()))
    expected = set(Base.metadata.tables)
    missing = sorted(expected - table_names)
    if missing:
        raise RuntimeError(f"Missing tables: {', '.join(missing)}")
    return sorted(expected)


async def _seed_demo() -> None:
    async with AsyncSessionLocal() as db:
        await ensure_demo_data(db)


async def _verify_http_flows() -> dict[str, str]:
    unique = uuid.uuid4().hex[:8].upper()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://verify") as client:
        register = await client.post(
            "/api/auth/student/register",
            json={
                "student_id": f"SUPA{unique}",
                "password": "student123",
                "name": f"Supabase Verify {unique}",
                "grade": 2,
                "mother_tongue": "sat",
            },
        )
        register.raise_for_status()
        token = register.json()["token"]
        student = register.json()["student"]

        login = await client.post(
            "/api/auth/student/login",
            json={"student_id": f"SUPA{unique}", "password": "student123"},
        )
        login.raise_for_status()

        profile = await client.get(
            f"/api/student/{student['id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        profile.raise_for_status()

        classroom = (
            await client.post(
                "/api/classroom/classes",
                json={
                    "name": f"Supabase Verify Class {unique}",
                    "grade": 2,
                    "section": "V",
                    "subject_focus": "Mathematics",
                    "teacher_language": "hi",
                    "student_language": "sat",
                },
            )
        )
        classroom.raise_for_status()
        classroom_body = classroom.json()

        join = await client.post(
            "/api/classroom/classes/join",
            json={"class_code": classroom_body["class_code"], "student_id": student["id"]},
        )
        join.raise_for_status()

        session = await client.post(f"/api/classroom/classes/{classroom_body['id']}/start")
        session.raise_for_status()
        session_body = session.json()

        participants = await client.get(f"/api/classroom/session/{session_body['session_id']}/participants")
        participants.raise_for_status()

        lesson = await client.post(
            "/api/lessons/generate",
            json={
                "grade": 2,
                "subject": "Mathematics",
                "topic": f"Addition {unique}",
                "teacher_language": "hi",
                "student_language": "sat",
                "class_id": classroom_body["id"],
            },
        )
        lesson.raise_for_status()
        lesson_body = lesson.json()

        quiz = await client.post(
            "/api/quizzes/generate",
            json={"lesson_id": lesson_body["id"], "number_of_questions": 2, "language": "sat"},
        )
        quiz.raise_for_status()
        quiz_body = quiz.json()
        answers = [
            {"question_id": question["id"], "student_answer": question["correct_answer"]}
            for question in quiz_body["questions"]
        ]
        attempt = await client.post(
            f"/api/quizzes/{quiz_body['id']}/attempt",
            json={"student_id": student["id"], "answers": answers},
        )
        attempt.raise_for_status()

        progress = await client.post(
            f"/api/students/{student['id']}/progress",
            json={"event_type": "activity_completed", "competency": "Addition", "score": 80},
        )
        progress.raise_for_status()

        history = await client.get(f"/api/classroom/sessions?class_id={classroom_body['id']}")
        history.raise_for_status()

    return {
        "student_id": student["id"],
        "class_id": classroom_body["id"],
        "session_id": session_body["session_id"],
        "lesson_id": lesson_body["id"],
        "quiz_id": quiz_body["id"],
    }


def _verify_websockets(session_id: str) -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/student/verify") as websocket:
            websocket.send_json({"type": "ping"})
            assert websocket.receive_json() == {"type": "pong"}
        with client.websocket_connect(f"/ws/classroom/{session_id}/presence?type=student&name=Verifier") as websocket:
            assert websocket.receive_json()["type"] == "presence_snapshot"
            assert websocket.receive_json()["type"] == "participant_joined"
            websocket.send_json({"type": "leave"})
            assert websocket.receive_json()["type"] == "participant_left"


async def main() -> None:
    tables = await _verify_tables()
    await _seed_demo()
    created = await _verify_http_flows()
    _verify_websockets(created["session_id"])
    print("Supabase verification passed")
    print(f"tables={len(tables)}")
    print(f"student_id={created['student_id']}")
    print(f"class_id={created['class_id']}")
    print(f"session_id={created['session_id']}")


if __name__ == "__main__":
    asyncio.run(main())
