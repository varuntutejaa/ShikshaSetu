from fastapi.testclient import TestClient

from app.main import app


def test_student_websocket_ping() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/student/test-student") as websocket:
            websocket.send_json({"type": "ping"})
            assert websocket.receive_json() == {"type": "pong"}


def test_classroom_websocket_mock_pipeline_and_clean_disconnect() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/classroom/test-session") as websocket:
            websocket.send_json(
                {"type": "config", "source_language": "hi", "target_language": "sat"}
            )
            assert websocket.receive_json()["type"] == "config_ack"

            websocket.send_bytes(b"mock audio")
            event_types = [websocket.receive_json()["type"] for _ in range(4)]
            assert event_types == ["transcript", "translation", "audio", "latency"]


def test_classroom_presence_websocket_join_leave() -> None:
    with TestClient(app) as client:
        session = client.post("/api/classroom/session", json={"teacher_language": "hi", "student_language": "sat"}).json()
        with client.websocket_connect(
            f"/ws/classroom/{session['session_id']}/presence?type=student&name=Rahul"
        ) as websocket:
            snapshot = websocket.receive_json()
            joined = websocket.receive_json()
            assert snapshot["type"] == "presence_snapshot"
            assert joined["type"] == "participant_joined"
            assert joined["participant"]["display_name"] == "Rahul"
            websocket.send_json({"type": "leave"})
            left = websocket.receive_json()
            assert left["type"] == "participant_left"

        participants = client.get(f"/api/classroom/session/{session['session_id']}/participants").json()
        assert any(p["display_name"] == "Rahul" and p["status"] == "offline" for p in participants)
