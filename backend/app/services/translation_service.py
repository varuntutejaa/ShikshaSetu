"""Translation orchestration — validates languages and delegates to Sarvam."""

from app.core.exceptions import UnsupportedLanguageError
from app.core.languages import is_supported_language
from app.services.sarvam_service import SarvamService, get_sarvam_service


class TranslationService:
    def __init__(self, sarvam: SarvamService | None = None) -> None:
        self._sarvam = sarvam or get_sarvam_service()

    async def translate(
        self, text: str, source_language: str, target_language: str, context: dict | None = None
    ) -> dict:
        if not is_supported_language(source_language):
            raise UnsupportedLanguageError(f"Unsupported source language: {source_language}")
        if not is_supported_language(target_language):
            raise UnsupportedLanguageError(f"Unsupported target language: {target_language}")

        if source_language == target_language:
            return {"translated_text": text, "provider": "passthrough", "context_used": context}

        contextual_text = text
        if context:
            objectives = ", ".join(context.get("learning_objectives") or [])
            contextual_text = (
                "Translate for a primary-school classroom. Preserve educational meaning, "
                "use child-appropriate language, and keep examples aligned to this context: "
                f"class={context.get('class')}; subject={context.get('subject')}; "
                f"topic={context.get('topic')}; activity={context.get('activity')}; "
                f"learning_objectives={objectives}. Text: {text}"
            )
        result = await self._sarvam.translate(contextual_text, source_language, target_language)
        result["context_used"] = context
        return result


translation_service = TranslationService()


def get_translation_service() -> TranslationService:
    return translation_service
