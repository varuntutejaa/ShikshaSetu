"""LiveKit token issuance — the ONLY thing this backend does for video.

FastAPI never touches a video frame. It mints short-lived, scoped JWTs so a
browser (teacher) or the Android app (student) can connect directly to
LiveKit's SFU over WebRTC. The API secret never leaves this process.

Teacher publishes camera + mic (as an ordinary video-call track, separate
from the AI-audio copy sent over the classroom WebSocket). Student is
subscribe-only — per the target architecture, students don't publish video.
"""

import logging

from livekit import api as livekit_api

from app.core.config import settings
from app.core.exceptions import VideoNotConfiguredError
from app.schemas.classroom import ParticipantType

logger = logging.getLogger("shikshasetu.livekit")

ROOM_PREFIX = "classroom-"


def room_name_for_session(session_id: str) -> str:
    return f"{ROOM_PREFIX}{session_id}"


class LiveKitService:
    @property
    def is_configured(self) -> bool:
        return settings.livekit_configured

    def generate_token(
        self,
        *,
        session_id: str,
        participant_type: ParticipantType,
        identity: str,
        display_name: str | None = None,
    ) -> tuple[str, str, str]:
        """Returns (token, url, room). Raises VideoNotConfiguredError if
        LIVEKIT_URL/API_KEY/API_SECRET aren't set — callers must let AI audio
        keep working when this happens, never treat it as fatal."""
        if not self.is_configured:
            raise VideoNotConfiguredError(
                "Video is not configured on this backend (LIVEKIT_URL / "
                "LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing). AI audio "
                "translation is unaffected."
            )

        room = room_name_for_session(session_id)
        is_teacher = participant_type == ParticipantType.teacher

        grants = livekit_api.VideoGrants(
            room_join=True,
            room=room,
            can_publish=is_teacher,
            can_publish_data=False,
            can_subscribe=True,
        )

        token = (
            livekit_api.AccessToken(settings.livekit_api_key, settings.livekit_api_secret)
            .with_identity(identity)
            .with_name(display_name or identity)
            .with_grants(grants)
            .to_jwt()
        )
        return token, settings.livekit_url, room


livekit_service = LiveKitService()


def get_livekit_service() -> LiveKitService:
    return livekit_service
