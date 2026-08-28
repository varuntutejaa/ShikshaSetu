"""WS /ws/classroom/{session_id} — the core real-time translation pipeline.

Teacher microphone -> WebSocket -> FastAPI -> Sarvam STT -> Hindi transcript
-> translation -> target-language text -> TTS -> audio response -> student.

Protocol
--------
Client -> server:
  - text frame, JSON: {"type": "config", "source_language": "hi", "target_language": "sat",
    "content_type": "audio/webm"}
    (all fields optional; content_type should match whatever MediaRecorder.mimeType
    the browser actually used, so Sarvam is told the real container format —
    defaults to hi -> sat / audio/webm. May be sent again mid-session to change
    languages.)
  - binary frame: one utterance's raw audio bytes (WAV/webm/ogg — whatever the
    browser's MediaRecorder produced). Each binary frame is treated as one
    complete segment to keep the pipeline simple and avoid invoking an LLM
    per audio chunk, per the design constraint of a lightweight realtime path.

Server -> client, in order, per segment:
  {"type": "transcript",  "text": "...", "language": "hi"}
  {"type": "translation", "source_language": "hi", "target_language": "sat", "text": "..."}
  {"type": "audio",       "format": "audio/wav", "data": "<base64>"}
  {"type": "latency",     "total_ms": 1720}
On failure at any stage:
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


@router.websocket("/ws/classroom/{session_id}")
async def classroom_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    sarvam = get_sarvam_service()

    source_language = "hi"
    target_language = "sat"
    lesson_context = None
    # Real browser MediaRecorder output is webm/opus, not wav — the client
    # tells us its actual mimeType once via the config message so we pass
    # the correct content_type/extension to Sarvam instead of guessing.
    content_type = "audio/webm"
    segment_index = 0

    logger.info("Classroom session %s connected", session_id)

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
                    source_language = config.get("source_language", source_language)
                    target_language = config.get("target_language", target_language)
                    content_type = config.get("content_type", content_type)
                    lesson_context = config.get("lesson_context", lesson_context)
                    await websocket.send_json(
                        {
                            "type": "config_ack",
                            "source_language": source_language,
                            "target_language": target_language,
                        }
                    )
                continue

            audio_bytes = message.get("bytes")
            if not audio_bytes:
                continue

            segment_index += 1
            started_at = time.monotonic()

            try:
                extension = content_type.split("/")[-1].split(";")[0] or "wav"
                stt_result = await sarvam.speech_to_text(
                    audio_bytes,
                    filename=f"segment-{session_id}-{segment_index}.{extension}",
                    content_type=content_type,
                    language_hint=source_language,
                )
                await websocket.send_json(
                    {"type": "transcript", "text": stt_result["text"], "language": stt_result["language"]}
                )

                translation = await get_translation_service().translate(
                    stt_result["text"], source_language, target_language, lesson_context
                )
                await websocket.send_json(
                    {
                        "type": "translation",
                        "source_language": source_language,
                        "target_language": target_language,
                        "text": translation["translated_text"],
                        "context_used": translation.get("context_used"),
                    }
                )

                tts_result = await sarvam.text_to_speech(translation["translated_text"], target_language)
                await websocket.send_json(
                    {
                        "type": "audio",
                        "format": tts_result["format"],
                        "data": base64.b64encode(tts_result["audio_bytes"]).decode("ascii"),
                    }
                )

                total_ms = round((time.monotonic() - started_at) * 1000)
                await websocket.send_json({"type": "latency", "total_ms": total_ms})

            except AppError as exc:
                logger.warning("Classroom pipeline error in session %s: %s", session_id, exc.message)
                await websocket.send_json({"type": "error", "message": exc.message})
            except Exception:  # noqa: BLE001 — keep the socket alive on unexpected errors
                logger.exception("Unexpected classroom pipeline failure in session %s", session_id)
                await websocket.send_json(
                    {"type": "error", "message": "Unexpected error processing audio segment"}
                )

    except WebSocketDisconnect:
        logger.info("Classroom session %s disconnected", session_id)


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
