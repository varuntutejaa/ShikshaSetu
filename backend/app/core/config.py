"""Application configuration loaded from environment variables.

All secrets (API keys, database credentials) live only here and in the
process environment — never return them from an API response and never
let them leak into logs.
"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- General ---
    environment: str = Field(default="development", alias="ENVIRONMENT")
    service_name: str = "ShikshaSetu Backend"
    version: str = "1.0.0"

    # --- Mock mode ---
    # When true, every AI-backed service (STT/translation/TTS/LLM) returns
    # deterministic mock data instead of calling external providers. This
    # lets the frontend and Android app be developed without API credits.
    mock_mode: bool = Field(default=True, alias="MOCK_MODE")

    # --- Sarvam AI ---
    sarvam_api_key: str = Field(default="", alias="SARVAM_API_KEY")
    sarvam_base_url: str = Field(default="https://api.sarvam.ai", alias="SARVAM_BASE_URL")

    # --- LLM provider abstraction ---
    llm_provider: str = Field(default="mock", alias="LLM_PROVIDER")
    llm_api_key: str = Field(default="", alias="LLM_API_KEY")

    # --- LiveKit (teacher video pipeline — entirely separate from AI audio) ---
    # Video works independently of MOCK_MODE: it's "configured" or it isn't,
    # regardless of whether Sarvam/LLM calls are mocked. Leave these empty to
    # run with video showing "not configured" while AI audio still works.
    livekit_url: str = Field(default="", alias="LIVEKIT_URL")
    livekit_api_key: str = Field(default="", alias="LIVEKIT_API_KEY")
    livekit_api_secret: str = Field(default="", alias="LIVEKIT_API_SECRET")

    # --- Database ---
    database_url: str = Field(alias="DATABASE_URL")

    # --- CORS ---
    cors_origins: str = Field(
        default="http://localhost:3000,https://shikshasetu-teacher.onrender.com",
        alias="CORS_ORIGINS",
    )

    # --- Student auth ---
    # Shared secret required (as the X-Admin-Key header) to create new student
    # logins via POST /api/auth/student/register. Empty (the default) leaves
    # registration open — fine for local/demo use, but set this in any
    # deployment reachable by the public.
    admin_api_key: str = Field(default="", alias="ADMIN_API_KEY")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def has_sarvam_key(self) -> bool:
        return bool(self.sarvam_api_key)

    @property
    def has_llm_key(self) -> bool:
        return bool(self.llm_api_key) and self.llm_provider != "mock"

    @property
    def livekit_configured(self) -> bool:
        return bool(self.livekit_url and self.livekit_api_key and self.livekit_api_secret)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
