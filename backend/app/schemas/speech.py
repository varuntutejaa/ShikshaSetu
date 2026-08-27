from pydantic import BaseModel, Field, field_validator

from app.core.languages import is_supported_language


class TranscribeResponse(BaseModel):
    text: str
    language: str
    provider: str


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2500)
    language: str = Field(..., examples=["sat"])

    @field_validator("language")
    @classmethod
    def validate_language(cls, value: str) -> str:
        if not is_supported_language(value):
            raise ValueError(f"Unsupported language code: {value}")
        return value


class SynthesizeResponse(BaseModel):
    audio_url: str
    format: str
    language: str
    provider: str
