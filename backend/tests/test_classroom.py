import jwt

from app.core.config import settings


async def _create_session(client, **overrides):
    payload = {"teacher_language": "hi", "student_language": "sat", **overrides}
    response = await client.post("/api/classroom/session", json=payload)
    assert response.status_code == 200
    return response.json()


async def test_create_and_get_session(client):
    session = await _create_session(client)
    assert session["status"] == "active"
    assert session["teacher_language"] == "hi"
    assert session["student_language"] == "sat"

    response = await client.get(f"/api/classroom/session/{session['session_id']}")
    assert response.status_code == 200
    assert response.json()["session_id"] == session["session_id"]


async def test_create_join_start_history_and_participants(client):
    created = await client.post(
        "/api/classroom/classes",
        json={
            "name": "Class 2A Math",
            "grade": 2,
            "section": "A",
            "subject_focus": "Mathematics",
            "teacher_language": "hi",
            "student_language": "sat",
        },
    )
    assert created.status_code == 200
    classroom = created.json()
    assert len(classroom["class_code"]) == 6

    joined = await client.post("/api/classroom/classes/join", json={"class_code": classroom["class_code"].lower()})
    assert joined.status_code == 200
    assert joined.json()["classroom"]["id"] == classroom["id"]
    assert joined.json()["active_session"] is None

    started = await client.post(f"/api/classroom/classes/{classroom['id']}/start")
    assert started.status_code == 200
    session = started.json()
    assert session["class_id"] == classroom["id"]
    assert session["status"] == "active"

    duplicate_start = await client.post(f"/api/classroom/classes/{classroom['id']}/start")
    assert duplicate_start.json()["session_id"] == session["session_id"]

    active = await client.get(f"/api/classroom/sessions?class_id={classroom['id']}&status=active")
    assert active.status_code == 200
    assert [s["session_id"] for s in active.json()] == [session["session_id"]]

    participants = await client.get(f"/api/classroom/session/{session['session_id']}/participants")
    assert participants.status_code == 200
    assert participants.json() == []

    content = await client.post(
        f"/api/classroom/session/{session['session_id']}/content",
        json={"lesson_id": None, "slide_index": 2},
    )
    assert content.status_code == 200
    assert content.json()["current_slide_index"] == 2

    metrics = await client.get("/api/classroom/metrics")
    assert metrics.status_code == 200
    assert metrics.json()["source"] == "persistent_data"


async def test_get_missing_session_returns_404(client):
    response = await client.get("/api/classroom/session/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_end_session(client):
    session = await _create_session(client)
    response = await client.post(f"/api/classroom/session/{session['session_id']}/end")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ended"
    assert body["ended_at"] is not None


async def test_livekit_token_returns_not_configured_when_no_credentials(client):
    """LIVEKIT_URL/API_KEY/API_SECRET are unset in the test environment —
    this must be a clean, typed error, never a crash, and never a fake token."""
    session = await _create_session(client)
    response = await client.post(
        "/api/classroom/livekit-token",
        json={"session_id": session["session_id"], "participant_type": "teacher"},
    )
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "LIVEKIT_NOT_CONFIGURED"


async def test_livekit_token_generated_when_configured(client):
    session = await _create_session(client)

    settings.livekit_url = "wss://example.livekit.cloud"
    settings.livekit_api_key = "test-key"
    settings.livekit_api_secret = "test-secret-at-least-32-bytes-long!!"
    try:
        response = await client.post(
            "/api/classroom/livekit-token",
            json={"session_id": session["session_id"], "participant_type": "teacher"},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["url"] == "wss://example.livekit.cloud"
        assert body["room"] == f"classroom-{session['session_id']}"

        claims = jwt.decode(body["token"], options={"verify_signature": False})
        assert claims["video"]["roomJoin"] is True
        assert claims["video"]["room"] == body["room"]
        assert claims["video"]["canPublish"] is True  # teacher publishes

        # Student gets a subscribe-only grant — never publishes video.
        student_response = await client.post(
            "/api/classroom/livekit-token",
            json={"session_id": session["session_id"], "participant_type": "student"},
        )
        student_claims = jwt.decode(student_response.json()["token"], options={"verify_signature": False})
        assert student_claims["video"]["canPublish"] is False
        assert student_claims["video"]["canSubscribe"] is True
    finally:
        settings.livekit_url = ""
        settings.livekit_api_key = ""
        settings.livekit_api_secret = ""


async def test_livekit_token_requires_existing_session(client):
    settings.livekit_url = "wss://example.livekit.cloud"
    settings.livekit_api_key = "test-key"
    settings.livekit_api_secret = "test-secret-at-least-32-bytes-long!!"
    try:
        response = await client.post(
            "/api/classroom/livekit-token",
            json={
                "session_id": "00000000-0000-0000-0000-000000000000",
                "participant_type": "teacher",
            },
        )
        assert response.status_code == 404
    finally:
        settings.livekit_url = ""
        settings.livekit_api_key = ""
        settings.livekit_api_secret = ""
