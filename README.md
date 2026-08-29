# ShikshaSetu

Smart Education, Jharkhand — a teacher web app that lets a Hindi-speaking
teacher run a live classroom that Ho, Mundari and Santhali-speaking students
can follow in their own mother tongue, with AI-generated lessons, quizzes
and viva assessments.

This is a monorepo with two independently deployed halves:

- **[`frontend/`](frontend/)** — the Next.js teacher web app (TypeScript,
  Tailwind, shadcn/ui). See [`frontend/AGENTS.md`](frontend/AGENTS.md) for
  Next.js-specific notes before making changes there.
- **[`backend/`](backend/)** — the FastAPI backend (Sarvam AI speech/
  translation, an LLM abstraction, Supabase Postgres, the classroom
  WebSocket pipeline). See [`backend/README.md`](backend/README.md) for the
  full setup, environment variables, and API reference.

A separate Android app (Kotlin/Jetpack Compose, in its own repository) is
the student-facing client — it only ever talks to this repo's FastAPI
backend, never directly to Sarvam, the LLM provider, or Supabase.

## What's actually built

- **Live Class** — a Meet/Zoom-style video-call UI (dark stage, floating
  control bar, toggleable side panel). Two independent real-time pipelines
  run per class, side by side, and one failing never blocks the other:
  - A real two-way voice call between teacher and student (raw audio relay,
    mic mute/unmute, an audio-level waveform driven by actual mic input).
  - A separate Hindi speech → Hindi transcript → Santali translation text
    pipeline (Sarvam Saaras STT + Sarvam Translate), processed in short
    ~3.5s segments as the teacher speaks — not a full-lecture recording.
    The side panel shows live Listening/Transcribing/Translating/Complete
    status and a real per-stage latency breakdown (STT / translation /
    total), all driven by actual events over the classroom WebSocket, never
    a timed animation.
  - Optional live video via LiveKit, independent of both audio pipelines.
- **AI Lesson Studio, Quiz Generator, AI Viva Assessment, Student
  Insights** — LLM- and Sarvam-backed, each with a documented mock/
  rule-based fallback so the app stays fully usable without live API keys.
- **Dashboard, Students, Settings** — wired to real backend data end to
  end; nothing hardcoded or simulated.
- **Public landing page** (`/`) — marketing overview of the above for
  signed-out visitors; `/login` is the actual teacher entry point.

Everything speech/translation-related is gated by the backend's
`MOCK_MODE` flag: `true` runs the whole app on deterministic mock
responses (no API keys needed, safe default); `false` calls the real
Sarvam AI API using `SARVAM_API_KEY`. See
[`backend/README.md`](backend/README.md#8-mock-mode) for details — Hindi
and Santali are fully live on Sarvam; Ho and Mundari currently fall back
to mock/LLM-assisted translation since Sarvam doesn't support them yet.

## Quick start

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Both run in mock mode by default — no API keys required to get the full
app working locally.

## Deployment

- **Backend**: Render, via the blueprint at `render.yaml` (repo root) —
  its `rootDir: backend` points Render at this subfolder. Auto-deploys on
  push to `main`.
- **Frontend**: Vercel, Root Directory set to `frontend/`. Also
  auto-deploys on push to `main` via Vercel's GitHub integration.

Push to `main` to deploy both — no separate manual step needed in the
normal case.
