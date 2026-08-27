"""WS /ws/classroom/{session_id} — the core real-time translation pipeline.

Teacher microphone -> WebSocket -> FastAPI -> Sarvam STT -> Hindi transcript
-> translation -> target-language text -> TTS -> audio response -> student.

Protocol
--------
Client -> server:
  - text frame, JSON: {"type": "config", "source_language": "hi", "target_language": "sat"}
    (optional; defaults to hi -> sat, may be sent again mid-session to change languages)
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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.exceptions import AppError
from app.services.sarvam_service import get_sarvam_service

logger = logging.getLogger("shikshasetu.ws.classroom")

router = APIRouter()


@router.websocket("/ws/classroom/{session_id}")
async def classroom_socket(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    sarvam = get_sarvam_service()

    source_language = "hi"
    target_language = "sat"
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
                stt_result = await sarvam.speech_to_text(
                    audio_bytes,
                    filename=f"segment-{session_id}-{segment_index}.wav",
                    content_type="audio/wav",
                    language_hint=source_language,
                )
                await websocket.send_json(
                    {"type": "transcript", "text": stt_result["text"], "language": stt_result["language"]}
                )

                translation = await sarvam.translate(stt_result["text"], source_language, target_language)
                await websocket.send_json(
                    {
                        "type": "translation",
                        "source_language": source_language,
                        "target_language": target_language,
                        "text": translation["translated_text"],
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
