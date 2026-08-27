"""Local-disk storage for generated audio.

Binary audio is never written to Postgres (see app/models/lesson.py). For
this hackathon build, synthesized audio is written to a local `media/`
directory and served via the `/media` static mount registered in main.py.
Swap this module for an S3/GCS client in production without touching
callers — every caller only depends on `save_audio_file` returning a URL.
"""

import uuid
from pathlib import Path

MEDIA_ROOT = Path(__file__).resolve().parent.parent.parent / "media"
AUDIO_DIR = MEDIA_ROOT / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def save_audio_file(audio_bytes: bytes, *, prefix: str = "audio", extension: str = "wav") -> str:
    filename = f"{prefix}-{uuid.uuid4().hex}.{extension}"
    path = AUDIO_DIR / filename
    path.write_bytes(audio_bytes)
    return f"/media/audio/{filename}"
