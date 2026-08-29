"""Language configuration for translation, speech and LLM services.

Sarvam AI's documented language support (as of the current API reference at
https://docs.sarvam.ai) confirms Hindi and Santali as supported BCP-47-style
codes. Ho and Mundari are NOT currently listed as supported Sarvam languages.
They are kept here as configured placeholders so the rest of the application
(routes, schemas, validation) can treat all four classroom languages
uniformly — requests for Ho/Mundari always fall back to the mock/LLM-assisted
path (see services/translation_service.py) rather than calling Sarvam
directly, and this is surfaced honestly in API responses via `provider`.

`sarvam_supported` gates STT and translate. TTS is tracked separately via
`tts_supported`: verified live against the real API, Sarvam's bulbul:v3
speech synthesis accepts Hindi/English text but rejects Santali text
("Text must contain at least one character from the allowed languages") even
though Santali is fully supported for STT and translate. Santali TTS isn't
in this MVP's scope anyway (text-only output), so `tts_supported=False` for
"sat" makes services/sarvam_service.py take the same mock-fallback path used
for genuinely unsupported languages, instead of making a live call that's
confirmed to always fail.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class LanguageConfig:
    code: str  # internal short code used throughout the app, e.g. "hi"
    sarvam_code: str | None  # Sarvam BCP-47-style code, e.g. "hi-IN"; None if unsupported
    name: str
    native_name: str
    sarvam_supported: bool  # gates STT + translate
    tts_supported: bool = True  # gates speech synthesis specifically


SUPPORTED_LANGUAGES: dict[str, LanguageConfig] = {
    "hi": LanguageConfig(
        code="hi",
        sarvam_code="hi-IN",
        name="Hindi",
        native_name="हिंदी",
        sarvam_supported=True,
        tts_supported=True,
    ),
    "sat": LanguageConfig(
        code="sat",
        sarvam_code="sat-IN",
        name="Santali",
        native_name="ᱥᱟᱱᱛᱟᱲᱤ",
        sarvam_supported=True,
        tts_supported=False,
    ),
    # Placeholders: not verified as supported by Sarvam AI at the time of
    # writing. Kept configurable so support can be enabled the moment the
    # provider adds them, without touching call sites.
    "ho": LanguageConfig(
        code="ho",
        sarvam_code=None,
        name="Ho",
        native_name="Ho",
        sarvam_supported=False,
        tts_supported=False,
    ),
    "unr": LanguageConfig(
        code="unr",
        sarvam_code=None,
        name="Mundari",
        native_name="Mundari",
        sarvam_supported=False,
        tts_supported=False,
    ),
    "en": LanguageConfig(
        code="en",
        sarvam_code="en-IN",
        name="English",
        native_name="English",
        sarvam_supported=True,
        tts_supported=True,
    ),
}

DEFAULT_TEACHER_LANGUAGE = "hi"
DEFAULT_STUDENT_LANGUAGE = "sat"


def is_supported_language(code: str) -> bool:
    return code in SUPPORTED_LANGUAGES


def get_language(code: str) -> LanguageConfig | None:
    return SUPPORTED_LANGUAGES.get(code)


def sarvam_code_for(code: str) -> str | None:
    lang = SUPPORTED_LANGUAGES.get(code)
    return lang.sarvam_code if lang else None
