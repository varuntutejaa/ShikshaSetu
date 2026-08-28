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

## Deployment

- Backend: Render, via the blueprint at `render.yaml` (repo root) — its
  `rootDir: backend` points Render at this subfolder.
- Frontend: Vercel and a second Render web service, both configured with
  their Root Directory set to `frontend/`.

Push to `main` to deploy — all three targets auto-deploy on commit.
