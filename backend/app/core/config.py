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

    # --- Database ---
    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/shikshasetu",
        alias="DATABASE_URL",
    )

    # --- CORS ---
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")

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


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
