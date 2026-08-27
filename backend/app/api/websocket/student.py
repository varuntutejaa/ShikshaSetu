"""WS /ws/student/{student_id} — realtime push channel to a student's app.

Used to push things the student device should react to immediately without
polling: a translated audio segment becoming available, a new lesson/quiz
being assigned, or a viva question being ready. The classroom pipeline
(app/api/websocket/classroom.py) and REST routes are the source of truth for
all state; this socket is purely a delivery channel — it holds no state of
its own beyond the connection registry below.

Protocol
--------
Client -> server: {"type": "ping"} (keepalive; server replies {"type": "pong"})
Server -> client: {"type": "notification", "event": "...", "payload": {...}}
"""

import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("shikshasetu.ws.student")

router = APIRouter()

# In-memory registry so other request handlers can push a notification to a
# connected student device. A hackathon-appropriate substitute for a real
# pub/sub layer (Redis, etc.) — fine for a single backend instance.
_active_connections: dict[str, WebSocket] = {}


async def notify_student(student_id: uuid.UUID, event: str, payload: dict) -> bool:
    """Push a notification to a student's live socket, if connected.

    Returns False (not an error) when the student isn't currently connected
    — callers should treat that as "will pick it up on next sync/poll".
    """
    connection = _active_connections.get(str(student_id))
    if connection is None:
        return False
    await connection.send_json({"type": "notification", "event": event, "payload": payload})
    return True


@router.websocket("/ws/student/{student_id}")
async def student_socket(websocket: WebSocket, student_id: str) -> None:
    await websocket.accept()
    _active_connections[student_id] = websocket
    logger.info("Student %s connected", student_id)

    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        logger.info("Student %s disconnected", student_id)
    finally:
        _active_connections.pop(student_id, None)
