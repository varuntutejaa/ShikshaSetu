"""Translation orchestration — validates languages and delegates to Sarvam."""

from app.core.exceptions import UnsupportedLanguageError
from app.core.languages import is_supported_language
from app.services.sarvam_service import SarvamService, get_sarvam_service


class TranslationService:
    def __init__(self, sarvam: SarvamService | None = None) -> None:
        self._sarvam = sarvam or get_sarvam_service()

    async def translate(self, text: str, source_language: str, target_language: str) -> dict:
        if not is_supported_language(source_language):
            raise UnsupportedLanguageError(f"Unsupported source language: {source_language}")
        if not is_supported_language(target_language):
            raise UnsupportedLanguageError(f"Unsupported target language: {target_language}")

        if source_language == target_language:
            return {"translated_text": text, "provider": "passthrough"}

        return await self._sarvam.translate(text, source_language, target_language)


translation_service = TranslationService()


def get_translation_service() -> TranslationService:
    return translation_service
