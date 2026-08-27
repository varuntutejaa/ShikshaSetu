from sqlalchemy import select

from app.models.progress import StudentProgress
from app.models.student import Student


async def _create_student(db_session) -> Student:
    student = Student(name="Kavita Devi", mother_tongue="ho", grade=2)
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


async def test_sync_processes_events(client, db_session):
    student = await _create_student(db_session)

    response = await client.post(
        "/api/sync",
        json={
            "student_id": str(student.id),
            "events": [
                {
                    "event_id": "evt-1",
                    "type": "quiz_completed",
                    "payload": {"quiz_id": "abc", "score": 8},
                }
            ],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["processed"] == ["evt-1"]
    assert body["failed"] == []


async def test_sync_is_idempotent_on_retry(client, db_session):
    student = await _create_student(db_session)
    payload = {
        "student_id": str(student.id),
        "events": [{"event_id": "evt-dup", "type": "lesson_completed", "payload": {}}],
    }

    first = await client.post("/api/sync", json=payload)
    second = await client.post("/api/sync", json=payload)

    assert first.json()["processed"] == ["evt-dup"]
    assert second.json()["processed"] == ["evt-dup"]

    result = await db_session.execute(
        select(StudentProgress).where(StudentProgress.student_id == student.id)
    )
    # Applied exactly once despite two identical sync submissions.
    assert len(result.scalars().all()) == 1
