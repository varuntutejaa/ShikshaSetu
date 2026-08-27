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
