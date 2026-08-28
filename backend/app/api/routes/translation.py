from fastapi import APIRouter, Depends

from app.schemas.translation import TranslationRequest, TranslationResponse
from app.services.translation_service import TranslationService, get_translation_service

router = APIRouter(prefix="/api/translation", tags=["translation"])


@router.post("", response_model=TranslationResponse)
async def translate_text(
    request: TranslationRequest,
    translator: TranslationService = Depends(get_translation_service),
) -> TranslationResponse:
    result = await translator.translate(
        request.text, request.source_language, request.target_language, request.context
    )
    return TranslationResponse(
        source_text=request.text,
        translated_text=result["translated_text"],
        source_language=request.source_language,
        target_language=request.target_language,
        provider=result["provider"],
        context_used=result.get("context_used"),
    )
