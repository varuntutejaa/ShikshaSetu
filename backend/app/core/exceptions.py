"""Application-level exceptions mapped to consistent JSON error responses.

Every error the API returns has the shape:

    {"error": {"code": "SOME_CODE", "message": "human readable message"}}

Never let raw stack traces or provider error bodies (which could contain
sensitive details) reach the client.
"""

from fastapi import status


class AppError(Exception):
    """Base class for all handled application errors."""

    code: str = "INTERNAL_ERROR"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str, *, code: str | None = None, status_code: int | None = None):
        self.message = message
        if code:
            self.code = code
        if status_code:
            self.status_code = status_code
        super().__init__(message)


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND


class ValidationAppError(AppError):
    code = "VALIDATION_ERROR"
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY


class UnsupportedLanguageError(AppError):
    code = "UNSUPPORTED_LANGUAGE"
    status_code = status.HTTP_400_BAD_REQUEST


class InvalidAudioError(AppError):
    code = "INVALID_AUDIO"
    status_code = status.HTTP_400_BAD_REQUEST


class TranslationFailedError(AppError):
    code = "TRANSLATION_FAILED"
    status_code = status.HTTP_502_BAD_GATEWAY


class SpeechServiceError(AppError):
    code = "SPEECH_SERVICE_FAILED"
    status_code = status.HTTP_502_BAD_GATEWAY


class LLMServiceError(AppError):
    code = "LLM_SERVICE_FAILED"
    status_code = status.HTTP_502_BAD_GATEWAY


class UpstreamTimeoutError(AppError):
    code = "UPSTREAM_TIMEOUT"
    status_code = status.HTTP_504_GATEWAY_TIMEOUT


class DatabaseError(AppError):
    code = "DATABASE_ERROR"
    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
