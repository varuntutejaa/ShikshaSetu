"""LLM provider abstraction.

The rest of the app calls `llm_service.generate_lesson(...)`,
`llm_service.generate_quiz(...)` etc. — never a provider SDK directly. This
keeps OpenAI / Gemini / Sarvam's own chat-completion API interchangeable via
`LLM_PROVIDER` + `LLM_API_KEY` without touching call sites.

Sarvam's chat-completion API (per docs.sarvam.ai) is OpenAI-compatible at
`/v1/chat/completions`, accepting either `api-subscription-key` or
`Authorization: Bearer <key>`. OpenAI's own API is compatible by
construction. Both are served here by the same `OpenAICompatibleProvider`,
parameterised by base URL and model — that's the whole abstraction.

When `LLM_PROVIDER=mock` (the default) or no API key is configured, a
deterministic template-based generator is used instead so the app is fully
demoable without spending any credits.
"""

import json
import logging
import re
import uuid
from abc import ABC, abstractmethod
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import LLMServiceError, UpstreamTimeoutError

logger = logging.getLogger("shikshasetu.llm")


class LLMProvider(ABC):
    @abstractmethod
    async def generate_lesson(
        self, *, grade: int, subject: str, topic: str, description: str | None
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def generate_quiz(
        self,
        *,
        grade: int,
        subject: str,
        topic: str,
        number_of_questions: int,
        types: list[str],
        difficulty: str,
    ) -> list[dict[str, Any]]: ...

    @abstractmethod
    async def generate_viva_question(
        self, *, subject: str, topic: str, grade: int, question_number: int
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def evaluate_viva_answer(
        self, *, question: str, student_answer_text: str, competency: str | None
    ) -> dict[str, Any]: ...

    @abstractmethod
    async def generate_learning_recommendation(
        self,
        *,
        student_name: str,
        mother_tongue: str,
        weak_concepts: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
    ) -> dict[str, Any]: ...


# ---------------------------------------------------------------------------
# Mock provider — deterministic, offline, zero cost
# ---------------------------------------------------------------------------

WORD_TO_NUM = {
    "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
    "thirteen": 13, "fourteen": 14, "fifteen": 15, "sixteen": 16,
    "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
}


def _extract_number(text: str) -> int | None:
    text = text.lower().strip()
    digit_match = re.search(r"-?\d+", text)
    if digit_match:
        return int(digit_match.group())
    for word, value in WORD_TO_NUM.items():
        if re.search(rf"\b{word}\b", text):
            return value
    return None


class MockLLMProvider(LLMProvider):
    async def generate_lesson(
        self, *, grade: int, subject: str, topic: str, description: str | None
    ) -> dict[str, Any]:
        objectives = [
            f"Understand the basic concept of {topic.lower()}",
            f"Apply {topic.lower()} confidently in Grade {grade} {subject.lower()} exercises",
            "Connect the concept to everyday, real-world examples",
        ]
        base_desc = description or f"Teach Grade {grade} students {topic} using simple real-world examples."
        teacher_script = (
            f"नमस्ते बच्चों! आज हम {subject} में {topic} सीखेंगे। {base_desc} "
            "चलिए एक उदाहरण से समझते हैं। मान लीजिए मेरे पास तीन आम हैं। "
            "अगर मैं इसमें दो और आम मिला दूँ, तो मेरे पास कुल कितने आम होंगे? "
            "आइए गिनते हैं — एक, दो, तीन, चार, पाँच। बहुत बढ़िया!"
        )
        activity = (
            f"Give each student 20 small stones, seeds or sticks. Ask them to form small groups "
            f"and physically count out {topic.lower()} problems together before writing anything down. "
            "Gradually increase the numbers as students grow confident."
        )
        return {
            "title": f"{topic}",
            "learning_objectives": objectives,
            "teacher_script": teacher_script,
            "activity": activity,
            "assessment_topics": [topic, f"Applied {topic}", "Number sense"],
        }

    async def generate_quiz(
        self,
        *,
        grade: int,
        subject: str,
        topic: str,
        number_of_questions: int,
        types: list[str],
        difficulty: str,
    ) -> list[dict[str, Any]]:
        questions: list[dict[str, Any]] = []
        type_cycle = types or ["mcq"]
        for i in range(number_of_questions):
            q_type = type_cycle[i % len(type_cycle)]
            a, b = (i % 9) + 1, ((i * 3) % 7) + 1
            answer = a + b
            if q_type == "true_false":
                statement_correct = i % 2 == 0
                shown_answer = answer if statement_correct else answer + 1
                questions.append(
                    {
                        "question": f"{a} + {b} = {shown_answer}",
                        "options": ["True", "False"],
                        "correct_answer": "True" if statement_correct else "False",
                        "question_type": q_type,
                        "difficulty": difficulty,
                        "competency": f"{topic} — basic facts",
                        "explanation": f"{a} + {b} equals {answer}.",
                    }
                )
            elif q_type == "fill_in_blank":
                questions.append(
                    {
                        "question": f"{a} + ___ = {answer}",
                        "options": None,
                        "correct_answer": str(b),
                        "question_type": q_type,
                        "difficulty": difficulty,
                        "competency": f"{topic} — missing addend",
                        "explanation": f"{answer} - {a} = {b}.",
                    }
                )
            elif q_type == "oral":
                questions.append(
                    {
                        "question": f"Say the answer aloud: {a} + {b}",
                        "options": None,
                        "correct_answer": str(answer),
                        "question_type": q_type,
                        "difficulty": difficulty,
                        "competency": f"{topic} — mental math",
                        "explanation": f"{a} + {b} equals {answer}.",
                    }
                )
            elif q_type == "picture_based":
                questions.append(
                    {
                        "question": f"Count the objects shown in two groups of {a} and {b}. What is the total?",
                        "options": [str(answer - 1), str(answer), str(answer + 1), str(answer + 2)],
                        "correct_answer": str(answer),
                        "question_type": q_type,
                        "difficulty": difficulty,
                        "competency": f"{topic} — counting",
                        "explanation": f"{a} + {b} equals {answer}.",
                    }
                )
            else:  # mcq
                options = [str(answer - 1), str(answer), str(answer + 1), str(answer + 2)]
                questions.append(
                    {
                        "question": f"{a} + {b} = ?",
                        "options": options,
                        "correct_answer": str(answer),
                        "question_type": "mcq",
                        "difficulty": difficulty,
                        "competency": f"{topic} — basic addition",
                        "explanation": f"{a} + {b} equals {answer}.",
                    }
                )
        return questions

    async def generate_viva_question(
        self, *, subject: str, topic: str, grade: int, question_number: int
    ) -> dict[str, Any]:
        a = (question_number * 2 % 9) + 1
        b = (question_number * 3 % 7) + 1
        return {
            "question": f"What is {a} + {b}?",
            "competency": f"{topic} — basic addition",
            "expected_answer": str(a + b),
        }

    async def evaluate_viva_answer(
        self, *, question: str, student_answer_text: str, competency: str | None
    ) -> dict[str, Any]:
        expected = None
        arithmetic_match = re.search(r"(\d+)\s*\+\s*(\d+)", question)
        if arithmetic_match:
            expected = int(arithmetic_match.group(1)) + int(arithmetic_match.group(2))

        given = _extract_number(student_answer_text)
        if expected is not None:
            # A numeric answer was expected — only a matching number (digit
            # or word form) counts as correct. An unparsable response to a
            # numeric question is wrong, not a free pass.
            correct = given is not None and given == expected
            confidence = 0.94 if correct else 0.88
        else:
            # No arithmetic answer to check against — fall back to a loose
            # non-empty-response heuristic so the demo still produces a
            # plausible-looking evaluation for open-ended subjects.
            correct = len(student_answer_text.strip()) > 0
            confidence = 0.6

        feedback = "Correct answer." if correct else (
            f"Not quite — the expected answer was {expected}." if expected is not None
            else "Response noted; please review with the student."
        )
        return {
            "correct": correct,
            "score": 1.0 if correct else 0.0,
            "confidence": confidence,
            "feedback": feedback,
            "competency": competency,
        }

    async def generate_learning_recommendation(
        self,
        *,
        student_name: str,
        mother_tongue: str,
        weak_concepts: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
    ) -> dict[str, Any]:
        if not weak_concepts:
            return {
                "recommendation": "No persistent learning gap detected from recorded assessments yet.",
                "intervention_activity": None,
            }
        weakest = weak_concepts[0]
        return {
            "recommendation": (
                f"{weakest['concept']} weakness detected at {weakest['average_score']}%. "
                f"Run a 5-minute {mother_tongue} activity using local objects."
            ),
            "intervention_activity": {
                "duration_minutes": 5,
                "language": mother_tongue,
                "activity": f"Ask {student_name} to explain 5 examples of {weakest['concept']} in their mother tongue.",
            },
        }


# ---------------------------------------------------------------------------
# OpenAI-compatible provider (OpenAI, Sarvam chat completions, etc.)
# ---------------------------------------------------------------------------

PROVIDER_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "sarvam": f"{settings.sarvam_base_url}/v1",
    # Groq hosts an OpenAI-compatible chat-completions API, served by the
    # same OpenAICompatibleProvider below — no separate client needed.
    "groq": "https://api.groq.com/openai/v1",
}

PROVIDER_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "sarvam": "sarvam-105b-conversations",
    "groq": "llama-3.3-70b-versatile",
}


class OpenAICompatibleProvider(LLMProvider):
    def __init__(self, provider_name: str):
        self.provider_name = provider_name
        self.base_url = PROVIDER_BASE_URLS.get(provider_name, PROVIDER_BASE_URLS["openai"])
        self.model = PROVIDER_DEFAULT_MODELS.get(provider_name, "gpt-4o-mini")

    async def _chat_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        client_headers = {"Authorization": f"Bearer {settings.llm_api_key}"}
        if self.provider_name == "sarvam":
            client_headers["api-subscription-key"] = settings.llm_api_key

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }
        try:
            async with httpx.AsyncClient(base_url=self.base_url, timeout=30.0) as client:
                response = await client.post(
                    "/chat/completions", json=payload, headers=client_headers
                )
                response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise UpstreamTimeoutError(f"{self.provider_name} LLM request timed out") from exc
        except httpx.HTTPError as exc:
            logger.error("%s chat completion failed: %s", self.provider_name, exc)
            raise LLMServiceError(f"{self.provider_name} LLM request failed") from exc

        body = response.json()
        try:
            content = body["choices"][0]["message"]["content"]
            return json.loads(content)
        except (KeyError, IndexError, json.JSONDecodeError) as exc:
            raise LLMServiceError("LLM returned an unparsable response") from exc

    async def generate_lesson(
        self, *, grade: int, subject: str, topic: str, description: str | None
    ) -> dict[str, Any]:
        system = (
            "You are a curriculum designer for Indian government primary schools. "
            "Respond ONLY with a JSON object with keys: title, learning_objectives "
            "(array of strings), teacher_script (a warm, simple Hindi teaching script), "
            "activity (a hands-on classroom activity using locally available objects), "
            "assessment_topics (array of strings)."
        )
        user = (
            f"Grade: {grade}\nSubject: {subject}\nTopic: {topic}\n"
            f"Description: {description or 'N/A'}"
        )
        return await self._chat_json(system, user)

    async def generate_quiz(
        self,
        *,
        grade: int,
        subject: str,
        topic: str,
        number_of_questions: int,
        types: list[str],
        difficulty: str,
    ) -> list[dict[str, Any]]:
        system = (
            "You are an assessment designer for Indian primary schools. Respond ONLY with a "
            'JSON object {"questions": [...]}, each item having keys: question, options '
            "(array of strings or null for non-MCQ types), correct_answer, question_type "
            "(one of mcq, true_false, picture_based, oral, fill_in_blank), difficulty, "
            "competency, explanation."
        )
        user = (
            f"Grade: {grade}\nSubject: {subject}\nTopic: {topic}\n"
            f"Number of questions: {number_of_questions}\nAllowed types: {types}\n"
            f"Difficulty: {difficulty}"
        )
        result = await self._chat_json(system, user)
        return result.get("questions", [])

    async def generate_viva_question(
        self, *, subject: str, topic: str, grade: int, question_number: int
    ) -> dict[str, Any]:
        system = (
            "You are conducting a short spoken assessment (viva) with a primary school "
            'student. Respond ONLY with a JSON object with keys: question, competency, '
            "expected_answer."
        )
        user = f"Grade: {grade}\nSubject: {subject}\nTopic: {topic}\nQuestion number: {question_number}"
        return await self._chat_json(system, user)

    async def evaluate_viva_answer(
        self, *, question: str, student_answer_text: str, competency: str | None
    ) -> dict[str, Any]:
        system = (
            "You evaluate a primary school student's spoken answer semantically — accept "
            "numerals, number words, and full sentences as equivalent (e.g. '5', 'five' and "
            '\'three plus two is five\' are all correct for expected answer 5). Respond ONLY '
            'with a JSON object with keys: correct (boolean), score (0 or 1), confidence '
            "(0-1 float), feedback (short string), competency."
        )
        user = f"Question: {question}\nStudent answer: {student_answer_text}\nCompetency: {competency or 'N/A'}"
        return await self._chat_json(system, user)

    async def generate_learning_recommendation(
        self,
        *,
        student_name: str,
        mother_tongue: str,
        weak_concepts: list[dict[str, Any]],
        strengths: list[dict[str, Any]],
    ) -> dict[str, Any]:
        system = (
            "You are an instructional coach helping a Hindi-speaking teacher support one "
            "student in a multilingual Indian primary classroom. You're given that student's "
            "real, measured weak and strong concepts (average scores from their actual "
            "recorded quizzes/viva sessions) — never invent concepts not listed. Write a "
            "short, specific, encouraging recommendation for the teacher (1-2 sentences) and, "
            "if there is at least one weak concept, one concrete 5-10 minute intervention "
            "activity using everyday local objects (stones, sticks, seeds, leaves), to be "
            "conducted in the student's mother tongue. Respond ONLY with a JSON object with "
            'keys: "recommendation" (string), "intervention_activity" (an object with '
            '"duration_minutes" (int), "language" (string, the mother tongue), "activity" '
            '(string) — or null if there are no weak concepts).'
        )
        user = (
            f"Student: {student_name}\nMother tongue: {mother_tongue}\n"
            f"Weak concepts (concept, average_score%): {weak_concepts}\n"
            f"Strengths (concept, average_score%): {strengths}"
        )
        return await self._chat_json(system, user)


class LLMService:
    """Facade the rest of the app depends on."""

    def __init__(self) -> None:
        self._provider: LLMProvider | None = None

    def _get_provider(self) -> LLMProvider:
        if self._provider is not None:
            return self._provider
        if settings.llm_provider == "mock" or not settings.has_llm_key:
            self._provider = MockLLMProvider()
        elif settings.llm_provider in PROVIDER_BASE_URLS:
            self._provider = OpenAICompatibleProvider(settings.llm_provider)
        else:
            logger.warning(
                "Unknown LLM_PROVIDER=%s, falling back to mock provider", settings.llm_provider
            )
            self._provider = MockLLMProvider()
        return self._provider

    async def generate_lesson(self, **kwargs) -> dict[str, Any]:
        return await self._get_provider().generate_lesson(**kwargs)

    async def generate_quiz(self, **kwargs) -> list[dict[str, Any]]:
        return await self._get_provider().generate_quiz(**kwargs)

    async def generate_viva_question(self, **kwargs) -> dict[str, Any]:
        return await self._get_provider().generate_viva_question(**kwargs)

    async def evaluate_viva_answer(self, **kwargs) -> dict[str, Any]:
        return await self._get_provider().evaluate_viva_answer(**kwargs)

    async def generate_learning_recommendation(self, **kwargs) -> dict[str, Any]:
        return await self._get_provider().generate_learning_recommendation(**kwargs)


llm_service = LLMService()


def get_llm_service() -> LLMService:
    return llm_service
