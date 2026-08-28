import app.api.routes.students as students_routes
from app.core.exceptions import LLMServiceError
from app.core.security import hash_password
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

    insights_response = await client.get(f"/api/students/{student.id}/learning-insights")
    assert insights_response.status_code == 200
    insights = insights_response.json()
    assert insights["strengths"][0]["concept"] == "Addition"
    assert insights["recommendation"]


class _FakeLLMService:
    """Stands in for the real llm_service so these tests never make a
    network call to Groq/OpenAI/Sarvam — see app/services/llm_service.py."""

    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    async def generate_learning_recommendation(self, **kwargs):
        if self._error:
            raise self._error
        return self._result


async def test_learning_insights_uses_llm_recommendation_when_available(client, db_session, monkeypatch):
    student = await _create_student(db_session)
    await client.post(
        f"/api/students/{student.id}/progress",
        json={"event_type": "quiz", "competency": "Addition above 10", "score": 40},
    )

    fake_result = {
        "recommendation": "Focus on Addition above 10 with hands-on counting.",
        "intervention_activity": {
            "duration_minutes": 7,
            "language": "sat",
            "activity": "Count stones together.",
        },
    }
    monkeypatch.setattr(students_routes, "get_llm_service", lambda: _FakeLLMService(result=fake_result))

    response = await client.get(f"/api/students/{student.id}/learning-insights")
    assert response.status_code == 200
    body = response.json()
    assert body["recommendation"] == fake_result["recommendation"]
    assert body["intervention_activity"] == fake_result["intervention_activity"]
    assert body["recommendation_source"] == "llm"


async def test_learning_insights_falls_back_when_llm_fails(client, db_session, monkeypatch):
    """A Groq/LLM outage must never break this endpoint — it degrades to the
    deterministic rule-based recommendation instead of a 500."""
    student = await _create_student(db_session)
    await client.post(
        f"/api/students/{student.id}/progress",
        json={"event_type": "quiz", "competency": "Addition above 10", "score": 40},
    )

    monkeypatch.setattr(
        students_routes,
        "get_llm_service",
        lambda: _FakeLLMService(error=LLMServiceError("groq unavailable")),
    )

    response = await client.get(f"/api/students/{student.id}/learning-insights")
    assert response.status_code == 200
    body = response.json()
    assert body["recommendation_source"] == "rule_based_fallback"
    assert "Addition above 10" in body["recommendation"]
    assert body["intervention_activity"]["duration_minutes"] == 5


async def test_student_app_profile_endpoint(client, db_session):
    student = Student(
        name="Birsa Murmu",
        mother_tongue="sat",
        grade=2,
        school="Govt Primary School",
        student_code="STU7001",
        password_hash=hash_password("student123"),
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)

    login = await client.post(
        "/api/auth/student/login", json={"student_id": "STU7001", "password": "student123"}
    )
    token = login.json()["token"]

    response = await client.get(
        f"/api/student/{student.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(student.id)
