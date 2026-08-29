"""Thin async client around the Sarvam AI REST APIs.

Endpoints/schemas below were verified against the official docs at
https://docs.sarvam.ai (api-reference-docs) at the time of writing:

  POST {base}/speech-to-text        multipart: file, model, mode
                                     -> {request_id, transcript, language_code}
  POST {base}/translate             json: input, source_language_code,
                                           target_language_code, mode, model
                                     -> {request_id, translated_text, ...}
  POST {base}/text-to-speech        json: text, language_code, speaker, model, pace
                                     -> {request_id, audios: [base64 wav, ...]}

Auth header: `api-subscription-key: <SARVAM_API_KEY>`.

Every method falls back to deterministic mock output when `MOCK_MODE=true`,
the API key is missing, or the requested language has no confirmed Sarvam
language code (see app.core.languages — Ho and Mundari currently fall into
this bucket). This keeps the app fully runnable without API credits and
never silently sends an unsupported language code to a real endpoint.
"""

import base64
import logging
import uuid

import httpx

from app.core.config import settings
from app.core.exceptions import SpeechServiceError, TranslationFailedError, UpstreamTimeoutError
from app.core.languages import get_language, sarvam_code_for

logger = logging.getLogger("shikshasetu.sarvam")

STT_MODEL = "saaras:v3"
TTS_MODEL = "bulbul:v3"
# Verified against a live call: bulbul:v3 rejects "anushka" (a bulbul:v2
# speaker name) with "Speaker 'anushka' is not compatible with model
# bulbul:v3" — "priya" is one of bulbul:v3's actual documented speakers.
DEFAULT_TTS_SPEAKER = "priya"
# mayura:v1 (Sarvam's translate default when no model is given) does not
# support Santali — verified live: it 400s with "Language 'sat-IN' is not
# supported in mayura:v1. Please switch to sarvam-translate:v1 to use this
# language." sarvam-translate:v1 supports Santali and was verified live for
# hi->sat and hi->en both, so it's used for every translate call.
TRANSLATE_MODEL = "sarvam-translate:v1"

MOCK_TRANSCRIPTS = {
    "hi": "तीन और दो जोड़ने पर कितने होते हैं?",
    "en": "How much is three plus two?",
    # Student-side (reverse direction) mock utterance — "It is five" — so the
    # student→teacher leg of the two-way pipeline has a realistic mock
    # transcript instead of silently reusing the Hindi teacher line.
    "sat": "Mon kanae.",
}

MOCK_TRANSLATIONS = {
    ("hi", "sat"): "Pe ar bar ratge kotenag kanae?",
    ("hi", "ho"): "[Ho translation placeholder — Sarvam Ho support not yet available] Pe ar bar ratge kotenag kanae?",
    ("hi", "unr"): "[Mundari translation placeholder — Sarvam Mundari support not yet available] Pe ar bar ratge kotenag kanae?",
    ("sat", "hi"): "पाँच होते हैं।",
}

# A minimal valid (silent, ~0.2s) WAV file used as mock TTS output so the
# audio pipeline is exercisable end-to-end without a real API key.
_MOCK_WAV_BASE64 = (
    "UklGRiQAAABXQVZFZm10IBAAAAABAAEAgD4AAIA+AAABAAgAZGF0YQAAAAA="
)


class SarvamService:
    def __init__(self) -> None:
        self._client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=settings.sarvam_base_url,
                headers={"api-subscription-key": settings.sarvam_api_key},
                timeout=httpx.Timeout(15.0, connect=5.0),
            )
        return self._client

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    @property
    def _live(self) -> bool:
        return not settings.mock_mode and settings.has_sarvam_key

    # ------------------------------------------------------------------
    # Speech to text
    # ------------------------------------------------------------------
    async def speech_to_text(
        self, audio_bytes: bytes, filename: str, content_type: str, language_hint: str = "hi"
    ) -> dict:
        if not self._live:
            text = MOCK_TRANSCRIPTS.get(language_hint, MOCK_TRANSCRIPTS["hi"])
            return {"text": text, "language": language_hint, "provider": "mock"}

        client = self._get_client()
        # Verified live: Sarvam matches the multipart file's content-type
        # against an exact allowlist (e.g. "audio/webm", "audio/wav") and
        # 400s on anything with codec parameters attached — a real browser
        # MediaRecorder reports "audio/webm;codecs=opus", which Sarvam
        # rejects outright even though the base "audio/webm" is allowed and
        # opus is exactly what's inside a webm/opus container. Strip
        # parameters before sending; the bytes themselves are untouched.
        base_content_type = content_type.split(";")[0].strip() or content_type
        files = {"file": (filename, audio_bytes, base_content_type)}
        data = {"model": STT_MODEL, "mode": "transcribe"}
        try:
            response = await client.post("/speech-to-text", files=files, data=data)
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError("Sarvam speech-to-text request timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam STT failed: %s | response body: %s", exc, exc.response.text[:500])
            raise SpeechServiceError("Speech-to-text service temporarily unavailable") from exc
        except httpx.HTTPError as exc:
            logger.error("Sarvam STT failed: %s", exc)
            raise SpeechServiceError("Speech-to-text service temporarily unavailable") from exc

        body = response.json()
        detected = body.get("language_code", "")
        short_code = _short_code_from_sarvam(detected) or language_hint
        return {
            "text": body.get("transcript", ""),
            "language": short_code,
            "provider": "sarvam",
        }

    # ------------------------------------------------------------------
    # Translation
    # ------------------------------------------------------------------
    async def translate(self, text: str, source_language: str, target_language: str) -> dict:
        source_cfg = get_language(source_language)
        target_cfg = get_language(target_language)
        can_call_sarvam = (
            self._live
            and source_cfg is not None
            and target_cfg is not None
            and source_cfg.sarvam_supported
            and target_cfg.sarvam_supported
        )

        if not can_call_sarvam:
            translated = MOCK_TRANSLATIONS.get(
                (source_language, target_language),
                f"[{target_language}] {text}",
            )
            return {"translated_text": translated, "provider": "mock"}

        client = self._get_client()
        payload = {
            "input": text,
            "source_language_code": sarvam_code_for(source_language),
            "target_language_code": sarvam_code_for(target_language),
            "mode": "formal",
            "model": TRANSLATE_MODEL,
        }
        try:
            response = await client.post(
                "/translate", json=payload, headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError("Sarvam translate request timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam translate failed: %s | response body: %s", exc, exc.response.text[:500])
            raise TranslationFailedError("Translation service temporarily unavailable") from exc
        except httpx.HTTPError as exc:
            logger.error("Sarvam translate failed: %s", exc)
            raise TranslationFailedError("Translation service temporarily unavailable") from exc

        body = response.json()
        translated_text = body.get("translated_text") or body.get("translatedText", "")
        return {"translated_text": translated_text, "provider": "sarvam"}

    # ------------------------------------------------------------------
    # Text to speech
    # ------------------------------------------------------------------
    async def text_to_speech(self, text: str, target_language: str) -> dict:
        target_cfg = get_language(target_language)
        can_call_sarvam = self._live and target_cfg is not None and target_cfg.tts_supported

        if not can_call_sarvam:
            return {
                "audio_bytes": base64.b64decode(_MOCK_WAV_BASE64),
                "format": "audio/wav",
                "provider": "mock",
            }

        client = self._get_client()
        payload = {
            "text": text[:2500],
            "language_code": sarvam_code_for(target_language),
            "speaker": DEFAULT_TTS_SPEAKER,
            "model": TTS_MODEL,
        }
        try:
            response = await client.post(
                "/text-to-speech", json=payload, headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError("Sarvam text-to-speech request timed out") from exc
        except httpx.HTTPStatusError as exc:
            logger.error("Sarvam TTS failed: %s | response body: %s", exc, exc.response.text[:500])
            raise SpeechServiceError("Text-to-speech service temporarily unavailable") from exc
        except httpx.HTTPError as exc:
            logger.error("Sarvam TTS failed: %s", exc)
            raise SpeechServiceError("Text-to-speech service temporarily unavailable") from exc

        body = response.json()
        audios = body.get("audios") or []
        if not audios:
            raise SpeechServiceError("Text-to-speech service returned no audio")
        return {
            "audio_bytes": base64.b64decode(audios[0]),
            "format": "audio/wav",
            "provider": "sarvam",
        }

    # ------------------------------------------------------------------
    # Realtime classroom pipeline (used by the /ws/classroom websocket)
    # ------------------------------------------------------------------
    async def realtime_segment(
        self, audio_bytes: bytes, filename: str, content_type: str, source_language: str, target_language: str
    ) -> dict:
        """Process one utterance segment end-to-end: STT -> translate -> TTS.

        Sarvam's dedicated realtime/streaming STT protocol (WebSocket) is
        documented but not implemented here — for a hackathon-scale demo,
        chunking short utterances through the synchronous REST endpoints in
        sequence keeps the pipeline simple while still hitting the <=3s
        target end-to-end. This method is the natural place to swap in the
        streaming client later without touching callers.
        """
        stt_result = await self.speech_to_text(audio_bytes, filename, content_type, source_language)
        translation = await self.translate(stt_result["text"], source_language, target_language)
        tts_result = await self.text_to_speech(translation["translated_text"], target_language)
        return {
            "transcript": stt_result["text"],
            "transcript_language": stt_result["language"],
            "translated_text": translation["translated_text"],
            "audio_bytes": tts_result["audio_bytes"],
            "audio_format": tts_result["format"],
            "provider": tts_result["provider"],
        }


def _short_code_from_sarvam(sarvam_code: str) -> str | None:
    if not sarvam_code:
        return None
    prefix = sarvam_code.split("-")[0].lower()
    from app.core.languages import SUPPORTED_LANGUAGES

    for code, cfg in SUPPORTED_LANGUAGES.items():
        if cfg.sarvam_code and cfg.sarvam_code.lower().startswith(prefix):
            return code
    return None


sarvam_service = SarvamService()


def get_sarvam_service() -> SarvamService:
    return sarvam_service
