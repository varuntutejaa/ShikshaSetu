from app.models.student import Student


async def _create_student(db_session) -> Student:
    student = Student(name="Birsa Murmu", mother_tongue="sat", grade=2, school="Govt Primary School")
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


async def test_list_and_get_student(client, db_session):
    student = await _create_student(db_session)

    list_response = await client.get("/api/students")
    assert list_response.status_code == 200
    assert any(s["id"] == str(student.id) for s in list_response.json())

    detail_response = await client.get(f"/api/students/{student.id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["name"] == "Birsa Murmu"


async def test_get_missing_student_returns_404(client):
    response = await client.get("/api/students/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_record_and_fetch_progress(client, db_session):
    student = await _create_student(db_session)

    record_response = await client.post(
        f"/api/students/{student.id}/progress",
        json={"event_type": "lesson_completed", "competency": "Addition", "score": 80},
    )
    assert record_response.status_code == 200

    progress_response = await client.get(f"/api/students/{student.id}/progress")
    assert progress_response.status_code == 200
    events = progress_response.json()
    assert len(events) == 1
    assert events[0]["event_type"] == "lesson_completed"


async def test_student_app_profile_endpoint(client, db_session):
    student = await _create_student(db_session)
    response = await client.get(f"/api/student/{student.id}")
    assert response.status_code == 200
    assert response.json()["id"] == str(student.id)
