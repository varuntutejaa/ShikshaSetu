from pydantic import BaseModel, Field, field_validator

from app.core.languages import is_supported_language


class TranslationRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)
    source_language: str = Field(..., examples=["hi"])
    target_language: str = Field(..., examples=["sat"])

    @field_validator("source_language", "target_language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class TranslationResponse(BaseModel):
    source_text: str
    translated_text: str
    source_language: str
    target_language: str
    provider: str
