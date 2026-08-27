from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.core.exceptions import InvalidAudioError
from app.core.storage import save_audio_file
from app.schemas.speech import SynthesizeRequest, SynthesizeResponse, TranscribeResponse
from app.services.sarvam_service import SarvamService, get_sarvam_service

router = APIRouter(prefix="/api/speech", tags=["speech"])

ALLOWED_AUDIO_TYPES = {
    "audio/wav", "audio/x-wav", "audio/wave",
    "audio/mpeg", "audio/mp3",
    "audio/webm", "audio/ogg", "audio/flac", "audio/aac", "audio/mp4",
}
MAX_AUDIO_BYTES = 15 * 1024 * 1024  # 15 MB


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    language: str = Form(default="hi"),
    sarvam: SarvamService = Depends(get_sarvam_service),
) -> TranscribeResponse:
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise InvalidAudioError(f"Unsupported audio content type: {file.content_type}")

    audio_bytes = await file.read()
    if not audio_bytes:
        raise InvalidAudioError("Uploaded audio file is empty")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise InvalidAudioError("Uploaded audio file exceeds the 15MB limit")

    result = await sarvam.speech_to_text(
        audio_bytes, filename=file.filename or "audio.wav", content_type=file.content_type, language_hint=language
    )
    return TranscribeResponse(text=result["text"], language=result["language"], provider=result["provider"])


@router.post("/synthesize", response_model=SynthesizeResponse)
async def synthesize_speech(
    request: SynthesizeRequest,
    sarvam: SarvamService = Depends(get_sarvam_service),
) -> SynthesizeResponse:
    result = await sarvam.text_to_speech(request.text, request.language)
    audio_url = save_audio_file(result["audio_bytes"], prefix="tts")
    return SynthesizeResponse(
        audio_url=audio_url, format=result["format"], language=request.language, provider=result["provider"]
    )
