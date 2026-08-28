"""WS /ws/classroom/{session_id} — the core real-time translation pipeline.

Two-way: a teacher connection and a student connection can both attach to
the SAME `session_id`. Whichever side speaks gets STT'd in their own
language, translated to the other side's language, synthesized, and the
result is delivered to BOTH connections (tagged with who spoke) — so the
speaker's own UI can show "you said X → Y" and the listener's UI/device
plays the translated audio. This is still one WebSocket route and one
message architecture; no second WS was added for this. A single connection
(e.g. only the teacher, no student attached yet) behaves exactly as before:
results are delivered back to that one connection.

  Hindi mic (teacher)   -> STT(hi) -> translate(hi->sat) -> TTS(sat) -> both peers
  Santhali mic (student) -> STT(sat) -> translate(sat->hi) -> TTS(hi) -> both peers

Protocol
--------
Client -> server:
  - text frame, JSON: {"type": "config", "role": "teacher" | "student",
    "source_language": "hi", "target_language": "sat", "content_type": "audio/webm"}
    (all fields optional; "role" defaults to "teacher" for backward
    compatibility with a single-connection client. content_type should match
    whatever MediaRecorder.mimeType the browser actually used, so Sarvam is
    told the real container format — defaults to hi -> sat / audio/webm for
    a teacher, sat -> hi for a student. May be sent again mid-session.)
  - binary frame: one utterance's raw audio bytes (WAV/webm/ogg — whatever the
    browser's MediaRecorder produced). Each binary frame is treated as one
    complete segment to keep the pipeline simple and avoid invoking an LLM
    per audio chunk, per the design constraint of a lightweight realtime path.

Server -> client, in order, per segment, delivered to every connection
currently attached to this session_id (so both the speaker and the other
side receive it):
  {"type": "transcript",  "text": "...", "language": "hi", "speaker": "teacher", "direction": "teacher_to_student"}
  {"type": "translation", "source_language": "hi", "target_language": "sat", "text": "...", "speaker": "teacher", "direction": "teacher_to_student"}
  {"type": "audio",       "format": "audio/wav", "data": "<base64>", "speaker": "teacher", "direction": "teacher_to_student"}
  {"type": "latency",     "total_ms": 1720, "speaker": "teacher", "direction": "teacher_to_student"}
On failure at any stage (sent only to the connection whose segment failed):
  {"type": "error", "message": "..."}

Latency is measured wall-clock from the moment the audio frame finishes
arriving to the moment the audio response is about to be sent — never
fabricated.
"""

import base64
import json
import logging
import time
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.database import AsyncSessionLocal
from app.core.exceptions import AppError
from app.schemas.classroom import ParticipantResponse
from app.services.classroom_service import get_classroom_service
from app.services.lesson_service import get_lesson_service
from app.services.translation_service import get_translation_service
from app.services.sarvam_service import get_sarvam_service

logger = logging.getLogger("shikshasetu.ws.classroom")

router = APIRouter()


class PresenceManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = {}

    async def connect(self, session_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.setdefault(session_id, set()).add(websocket)

    def disconnect(self, session_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(session_id)
        if sockets is None:
            return
        sockets.discard(websocket)
        if not sockets:
            self._connections.pop(session_id, None)

    async def broadcast(self, session_id: str, payload: dict) -> None:
        for socket in list(self._connections.get(session_id, set())):
            try:
                await socket.send_json(payload)
            except Exception:
                self.disconnect(session_id, socket)


presence_manager = PresenceManager()


class AudioPeer:
    """One connection's role + language settings within a classroom's audio
    session. "teacher" and "student" default to mirror-image language pairs
    so either side can start speaking without an explicit config message."""

    def __init__(self, websocket: WebSocket, role: str = "teacher") -> None:
        self.websocket = websocket
        self.role = role
        self.source_language = "hi" if role == "teacher" else "sat"
        self.target_language = "sat" if role == "teacher" else "hi"
        self.content_type = "audio/webm"
        self.lesson_context: dict | None = None

    @property
    def direction(self) -> str:
        return "teacher_to_student" if self.role == "teacher" else "student_to_teacher"

    def apply_role(self, role: str) -> None:
        """Reset source/target to that role's defaults only when the role is
        actually changing — an explicit source/target in the same config
        message (handled by the caller) still wins."""
        if role == self.role:
            return
        self.role = role
        self.source_language = "hi" if role == "teacher" else "sat"
        self.target_language = "sat" if role == "teacher" else "hi"


class AudioSessionRegistry:
    """Per-classroom-session peer registry for the two-way audio pipeline.

    At most one connection per (session_id, role) — a reconnect simply
    replaces the previous entry, which is also how automatic WebSocket
    reconnection on the client naturally resolves. Broadcasting to every
    registered peer is what makes the pipeline two-way: if only one side is
    connected, results go back to that one connection (identical to the
    original single-direction behavior); once both are connected, each
    side's translated speech reaches the other automatically.
    """

    def __init__(self) -> None:
        # Keyed by connection identity (id(websocket)), NOT by role: every
        # connection starts out with the default role "teacher" until its
        # first config message arrives, so keying by role would let a second
        # connection silently overwrite the first one's slot before either
        # peer's real role is known — exactly the kind of bug that makes the
        # "first" connection vanish from broadcasts. See AudioPeer.apply_role
        # for how a peer's role can change in place without touching its
        # registry entry.
        self._sessions: dict[str, dict[int, AudioPeer]] = {}

    def register(self, session_id: str, peer: AudioPeer) -> None:
        self._sessions.setdefault(session_id, {})[id(peer.websocket)] = peer

    def unregister(self, session_id: str, peer: AudioPeer) -> None:
        peers = self._sessions.get(session_id)
        if not peers:
            return
        peers.pop(id(peer.websocket), None)
        if not peers:
            self._sessions.pop(session_id, None)

    def peers(self, session_id: str) -> list[AudioPeer]:
        return list(self._sessions.get(session_id, {}).values())

    async def broadcast(self, session_id: str, payload: dict) -> None:
        for peer in self.peers(session_id):
            try:
                await peer.websocket.send_json(payload)
            except Exception:
                # A dead socket here will also surface as WebSocketDisconnect
                # on that connection's own receive loop, which unregisters it.
                logger.debug("Could not deliver audio event to a peer in session %s", session_id)


audio_registry = AudioSessionRegistry()


@router.websocket("/ws/classroom/{session_id}")
async def classroom_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    sarvam = get_sarvam_service()

    peer = AudioPeer(websocket, role="teacher")
    audio_registry.register(session_id, peer)
    segment_index = 0

    logger.info("Classroom session %s connected (role=%s)", session_id, peer.role)

    try:
        while True:
            message = await websocket.receive()

            if message["type"] == "websocket.disconnect":
                break

            if message["type"] != "websocket.receive":
                continue

            if message.get("text") is not None:
                try:
                    config = json.loads(message["text"])
                except json.JSONDecodeError:
                    await websocket.send_json({"type": "error", "message": "Invalid JSON control message"})
                    continue

                if config.get("type") == "config":
                    requested_role = config.get("role", peer.role)
                    peer.apply_role(requested_role)
                    # Explicit source/target always wins over role defaults.
                    peer.source_language = config.get("source_language", peer.source_language)
                    peer.target_language = config.get("target_language", peer.target_language)
                    peer.content_type = config.get("content_type", peer.content_type)
                    peer.lesson_context = config.get("lesson_context", peer.lesson_context)
                    await websocket.send_json(
                        {
                            "type": "config_ack",
                            "role": peer.role,
                            "source_language": peer.source_language,
                            "target_language": peer.target_language,
                        }
                    )
                continue

            audio_bytes = message.get("bytes")
            if not audio_bytes:
                continue

            segment_index += 1
            started_at = time.monotonic()

            try:
                extension = peer.content_type.split("/")[-1].split(";")[0] or "wav"
                stt_result = await sarvam.speech_to_text(
                    audio_bytes,
                    filename=f"segment-{session_id}-{peer.role}-{segment_index}.{extension}",
                    content_type=peer.content_type,
                    language_hint=peer.source_language,
                )
                await audio_registry.broadcast(
                    session_id,
                    {
                        "type": "transcript",
                        "text": stt_result["text"],
                        "language": stt_result["language"],
                        "speaker": peer.role,
                        "direction": peer.direction,
                    },
                )

                translation = await get_translation_service().translate(
                    stt_result["text"], peer.source_language, peer.target_language, peer.lesson_context
                )
                await audio_registry.broadcast(
                    session_id,
                    {
                        "type": "translation",
                        "source_language": peer.source_language,
                        "target_language": peer.target_language,
                        "text": translation["translated_text"],
                        "context_used": translation.get("context_used"),
                        "speaker": peer.role,
                        "direction": peer.direction,
                    },
                )

                tts_result = await sarvam.text_to_speech(translation["translated_text"], peer.target_language)
                await audio_registry.broadcast(
                    session_id,
                    {
                        "type": "audio",
                        "format": tts_result["format"],
                        "data": base64.b64encode(tts_result["audio_bytes"]).decode("ascii"),
                        "speaker": peer.role,
                        "direction": peer.direction,
                    },
                )

                total_ms = round((time.monotonic() - started_at) * 1000)
                await audio_registry.broadcast(
                    session_id,
                    {"type": "latency", "total_ms": total_ms, "speaker": peer.role, "direction": peer.direction},
                )

            except AppError as exc:
                logger.warning("Classroom pipeline error in session %s: %s", session_id, exc.message)
                await websocket.send_json({"type": "error", "message": exc.message})
            except Exception:  # noqa: BLE001 — keep the socket alive on unexpected errors
                logger.exception("Unexpected classroom pipeline failure in session %s", session_id)
                await websocket.send_json(
                    {"type": "error", "message": "Unexpected error processing audio segment"}
                )

    except WebSocketDisconnect:
        logger.info("Classroom session %s disconnected (role=%s)", session_id, peer.role)
    finally:
        audio_registry.unregister(session_id, peer)


@router.websocket("/ws/classroom/{session_id}/presence")
async def classroom_presence_socket(websocket: WebSocket, session_id: str) -> None:
    await presence_manager.connect(session_id, websocket)
    service = get_classroom_service()
    participant_id = websocket.query_params.get("student_id")
    participant_type = websocket.query_params.get("type", "student")
    display_name = websocket.query_params.get("name", participant_type.capitalize())
    student_id = uuid.UUID(participant_id) if participant_id else None
    session_uuid = uuid.UUID(session_id)
    left_recorded = False

    try:
        async with AsyncSessionLocal() as db:
            joined = await service.record_presence(
                db, session_uuid, participant_type, display_name, student_id, online=True
            )
            participants = await service.list_participants(db, session_uuid)
        await presence_manager.broadcast(
            session_id,
            {
                "type": "presence_snapshot",
                "participants": [ParticipantResponse.model_validate(p).model_dump(mode="json") for p in participants],
            },
        )
        await presence_manager.broadcast(
            session_id,
            {"type": "participant_joined", "participant": ParticipantResponse.model_validate(joined).model_dump(mode="json")},
        )

        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            if message.get("type") == "set_content":
                lesson_id = uuid.UUID(message["lesson_id"]) if message.get("lesson_id") else None
                slide_index = int(message.get("slide_index", 0))
                async with AsyncSessionLocal() as db:
                    session = await service.set_session_content(db, session_uuid, lesson_id, slide_index)
                    pack = await get_lesson_service().offline_pack(db, lesson_id) if lesson_id else None
                await presence_manager.broadcast(
                    session_id,
                    {
                        "type": "content_changed",
                        "session_id": str(session.id),
                        "lesson_id": str(session.lesson_id) if session.lesson_id else None,
                        "slide_index": session.current_slide_index,
                        "offline_pack": pack,
                    },
                )
            if message.get("type") == "leave":
                async with AsyncSessionLocal() as db:
                    left = await service.record_presence(
                        db, session_uuid, participant_type, display_name, student_id, online=False
                    )
                payload = {
                    "type": "participant_left",
                    "participant": ParticipantResponse.model_validate(left).model_dump(mode="json"),
                }
                left_recorded = True
                await websocket.send_json(payload)
                await presence_manager.broadcast(session_id, payload)
                break

    except WebSocketDisconnect:
        pass
    finally:
        presence_manager.disconnect(session_id, websocket)
        try:
            if left_recorded:
                return
            async with AsyncSessionLocal() as db:
                left = await service.record_presence(
                    db, session_uuid, participant_type, display_name, student_id, online=False
                )
            await presence_manager.broadcast(
                session_id,
                {"type": "participant_left", "participant": ParticipantResponse.model_validate(left).model_dump(mode="json")},
            )
        except Exception:
            logger.exception("Could not record presence disconnect for session %s", session_id)
