from fastapi.testclient import TestClient

from app.api.websocket.classroom import AudioPeer, AudioSessionRegistry
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


class _FakeWebSocket:
    """Records every JSON payload (and, for raw_call, every binary frame)
    it's asked to send — stands in for a real WebSocket so
    AudioSessionRegistry.broadcast(_raw) can be tested deterministically,
    without going through a WebSocket transport at all."""

    def __init__(self) -> None:
        self.sent: list[dict] = []
        self.sent_bytes: list[bytes] = []

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)

    async def send_bytes(self, data: bytes) -> None:
        self.sent_bytes.append(data)


async def test_audio_session_registry_broadcasts_to_both_registered_peers() -> None:
    """This is the actual two-way mechanism: whichever peer speaks, every
    peer registered for that session_id gets the event. Verified directly
    against the registry/peer classes used by the real WS handler — see
    test_classroom_websocket_mock_pipeline_and_clean_disconnect and
    test_classroom_websocket_single_connection_still_self_delivers below for
    the real-transport version of the single-connection case (two
    simultaneous nested TestClient WebSocket connections are flaky in
    Starlette's test transport itself — a threading/portal limitation of the
    test harness, unrelated to this registry's logic; verified independently
    against a live uvicorn server with two real websockets clients)."""
    registry = AudioSessionRegistry()
    teacher_socket, student_socket = _FakeWebSocket(), _FakeWebSocket()
    teacher = AudioPeer(teacher_socket, role="teacher")  # type: ignore[arg-type]
    student = AudioPeer(student_socket, role="student")  # type: ignore[arg-type]

    registry.register("session-1", teacher)
    registry.register("session-1", student)
    assert {p.role for p in registry.peers("session-1")} == {"teacher", "student"}

    await registry.broadcast("session-1", {"type": "transcript", "text": "hello"})
    assert teacher_socket.sent == [{"type": "transcript", "text": "hello"}]
    assert student_socket.sent == [{"type": "transcript", "text": "hello"}]

    registry.unregister("session-1", student)
    await registry.broadcast("session-1", {"type": "latency", "total_ms": 42})
    assert teacher_socket.sent[-1] == {"type": "latency", "total_ms": 42}
    assert student_socket.sent == [{"type": "transcript", "text": "hello"}]  # unregistered, got nothing more

    # Last peer gone -> session entry cleaned up.
    registry.unregister("session-1", teacher)
    assert registry.peers("session-1") == []


async def test_audio_session_registry_keys_by_connection_not_role() -> None:
    """Regression guard: both connections default to role="teacher" until
    their own first config message arrives. If the registry keyed entries by
    role (instead of connection identity), the second connection to register
    would silently overwrite the first one's slot and the first would vanish
    from broadcasts until it happened to re-send config. Keying by
    id(websocket) makes that impossible."""
    registry = AudioSessionRegistry()
    first_socket, second_socket = _FakeWebSocket(), _FakeWebSocket()
    first = AudioPeer(first_socket, role="teacher")  # type: ignore[arg-type]
    second = AudioPeer(second_socket, role="teacher")  # type: ignore[arg-type]  # not yet role="student"

    registry.register("session-2", first)
    registry.register("session-2", second)
    assert len(registry.peers("session-2")) == 2  # neither one lost

    await registry.broadcast("session-2", {"type": "ping"})
    assert first_socket.sent == [{"type": "ping"}]
    assert second_socket.sent == [{"type": "ping"}]


def test_audio_peer_role_defaults_and_direction() -> None:
    teacher = AudioPeer(_FakeWebSocket(), role="teacher")  # type: ignore[arg-type]
    assert (teacher.source_language, teacher.target_language) == ("hi", "sat")
    assert teacher.direction == "teacher_to_student"

    student = AudioPeer(_FakeWebSocket(), role="student")  # type: ignore[arg-type]
    assert (student.source_language, student.target_language) == ("sat", "hi")
    assert student.direction == "student_to_teacher"

    # Switching role resets to that role's language defaults.
    teacher.apply_role("student")
    assert teacher.role == "student"
    assert (teacher.source_language, teacher.target_language) == ("sat", "hi")


async def test_audio_session_registry_broadcast_raw_relays_untouched_and_skips_sender() -> None:
    """Raw call mode: bytes go out exactly as received (no STT/translate/TTS
    touches them), tagged with a 1-byte speaker prefix, to every OTHER peer —
    never echoed back to whoever sent them, or they'd hear their own voice."""
    registry = AudioSessionRegistry()
    teacher_socket, student_socket = _FakeWebSocket(), _FakeWebSocket()
    teacher = AudioPeer(teacher_socket, role="teacher")  # type: ignore[arg-type]
    student = AudioPeer(student_socket, role="student")  # type: ignore[arg-type]
    registry.register("call-session", teacher)
    registry.register("call-session", student)

    raw_pcm = b"\x01\x02\x03\x04"
    await registry.broadcast_raw("call-session", teacher, raw_pcm)

    assert teacher_socket.sent_bytes == []  # sender never gets its own audio back
    assert student_socket.sent_bytes == [b"\x00" + raw_pcm]  # 0x00 = teacher spoke

    await registry.broadcast_raw("call-session", student, raw_pcm)
    assert student_socket.sent_bytes == [b"\x00" + raw_pcm]  # unchanged
    assert teacher_socket.sent_bytes == [b"\x01" + raw_pcm]  # 0x01 = student spoke


def test_classroom_websocket_raw_call_mode_bypasses_ai_pipeline() -> None:
    """A connection that opts into raw_call gets no transcript/translation/
    audio/latency events at all for its binary frames — just an ack
    confirming the mode, and (with no other peer attached) silence, since
    raw call intentionally never echoes audio back to its own sender."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/classroom/raw-solo-session") as websocket:
            websocket.send_json({"type": "config", "raw_call": True})
            ack = websocket.receive_json()
            assert ack["type"] == "config_ack"
            assert ack["raw_call"] is True

            websocket.send_bytes(b"\x11\x22\x33\x44")  # fake raw PCM
            # Nothing else attached to this session, so there's no receiver
            # to relay to — confirm the socket stays healthy by sending a
            # second, ordinary config message and getting a fresh ack back,
            # proving the raw frame didn't crash or hang the handler.
            websocket.send_json({"type": "config", "raw_call": True})
            ack2 = websocket.receive_json()
            assert ack2["type"] == "config_ack"


def test_classroom_websocket_single_connection_still_self_delivers() -> None:
    """No peer attached — the original single-direction behavior (results
    go back to whoever spoke) must still hold. Backward compatibility."""
    with TestClient(app) as client:
        with client.websocket_connect("/ws/classroom/solo-session") as websocket:
            websocket.send_json({"type": "config", "source_language": "hi", "target_language": "sat"})
            ack = websocket.receive_json()
            assert ack["type"] == "config_ack"
            assert ack["role"] == "teacher"  # default role, unchanged behavior

            websocket.send_bytes(b"mock audio")
            events = [websocket.receive_json() for _ in range(4)]
            assert [e["type"] for e in events] == ["transcript", "translation", "audio", "latency"]


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
