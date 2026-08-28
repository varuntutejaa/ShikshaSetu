# ShikshaSetu Backend

FastAPI backend for ShikshaSetu — the AI-powered multilingual classroom
assistant connecting a Hindi-speaking teacher to Ho/Mundari/Santhali-speaking
students, via Sarvam AI (speech/translation), a pluggable LLM (lessons,
quizzes, AI Viva), and LiveKit (live teacher video).

```
Teacher Web App
        ↓
   Camera + Mic
        ↓
 ┌──────┴──────┐
 ↓             ↓
VIDEO        AUDIO
 ↓             ↓
LiveKit    FastAPI WS
(WebRTC)       ↓
 │         Sarvam AI (STT → translate → TTS)
 │             ↓
 │        Translated audio
 └──────┬──────┘
        ↓
  Student (web/Android)

      + FastAPI REST: lessons, quizzes, AI Viva, students, sync, PostgreSQL
```

Video and AI audio are two **independent** realtime pipelines that never
touch each other: FastAPI only issues LiveKit tokens (never sees a video
frame), while AI audio translation runs entirely over its own WebSocket. If
one fails, the other keeps working — see §12.

The single most important thing this backend does:

```
Hindi teacher speech → STT → Hindi transcript → translation →
target language text → TTS → student audio
```

---

## 1. Requirements

- Python 3.11+
- PostgreSQL 14+ (or run in mock mode with any DB URL SQLAlchemy supports —
  see [Mock Mode](#8-mock-mode))
- (Optional) a Sarvam AI API key — https://dashboard.sarvam.ai
- (Optional) an LLM API key (OpenAI or Sarvam's chat-completion API)

## 2–3. Installation & virtual environment

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

## 4. Environment variables

Copy the example file and fill in what you have:

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `ENVIRONMENT` | `development` / `production` |
| `MOCK_MODE` | `true` (default) runs entirely offline with deterministic fake AI output. `false` calls real Sarvam/LLM APIs. |
| `SARVAM_API_KEY` | Sarvam AI subscription key. Required only when `MOCK_MODE=false`. |
| `SARVAM_BASE_URL` | Defaults to `https://api.sarvam.ai`. |
| `LLM_PROVIDER` | `mock` \| `openai` \| `sarvam`. |
| `LLM_API_KEY` | API key for the chosen LLM provider. |
| `DATABASE_URL` | SQLAlchemy async URL, e.g. `postgresql+asyncpg://user:pass@host:5432/db`. |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins. |
| `LIVEKIT_URL` | LiveKit server WebSocket URL, e.g. `wss://your-project.livekit.cloud`. |
| `LIVEKIT_API_KEY` | LiveKit API key. |
| `LIVEKIT_API_SECRET` | LiveKit API secret — used only to *sign* short-lived room tokens server-side. |
| `ADMIN_API_KEY` | Shared secret required as the `X-Admin-Key` header to create student logins via `POST /api/auth/student/register`. Empty (default) leaves registration open — fine for local/demo use; set this before exposing the backend publicly. |

**Secrets never leave the backend.** No API key or LiveKit secret is ever
returned in a response or forwarded to the Next.js frontend or the Android
app — the frontend only ever receives a short-lived, scoped LiveKit token
(see §15).

## 4a. Student authentication

The Android app logs students in with a **Student ID + password** (no
email) against `POST /api/auth/student/login`. Passwords are hashed with
bcrypt (`app/core/security.py`); sessions are opaque server-issued tokens
stored (hashed) in `student_sessions`, so `POST /api/auth/student/logout`
genuinely revokes access rather than just discarding a stateless JWT.

In mock mode (the default), three demo logins are seeded automatically on
startup — **demo credentials only, never real students**:

| Student ID | Password | Name |
|---|---|---|
| `STU1000` | `student123` | Rahul (the original seeded demo profile) |
| `STU1001` | `student123` | Sita Hansda |
| `STU1002` | `student123` | Amit Murmu |

New logins can be created via `POST /api/auth/student/register` (guarded by
`ADMIN_API_KEY` when set) — this is the demo/admin "create a student"
flow, exposed in the Android app as a "Create demo student ID" screen
reachable from Login.

Already have a deployed database from before auth existed? Run
`supabase/migrations/202608280001_student_auth.sql` against it — the new
columns are nullable so it's safe against existing rows, and the app also
backfills credentials onto the pre-existing demo student on startup.

## 5. Supabase PostgreSQL setup

Production uses Supabase as the managed PostgreSQL database
(project: https://oasooktdfzkgwuulzmrr.supabase.co, ref `oasooktdfzkgwuulzmrr`).
Do not create a separate local production database and do not expose
`DATABASE_URL` — or any Supabase service-role/API key — to Next.js/browser/
Android clients.

Set the backend/server-side environment variable (get the exact host/password
from Supabase Dashboard -> Project Settings -> Database -> Connection string):

```bash
DATABASE_URL=postgresql+asyncpg://postgres.oasooktdfzkgwuulzmrr:<db-password>@<supabase-host>:5432/postgres?ssl=require
```

Apply additive migrations with the Supabase CLI:

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

SQLite remains acceptable for isolated automated tests only. Production and
Render must use Supabase PostgreSQL.

**Android never talks to Supabase (or Postgres) directly.** The app only
ever calls the FastAPI/Render REST + WebSocket API (`API_BASE_URL` /
`WS_BASE_URL` in `app/build.gradle.kts`); FastAPI is the sole client of
Supabase. No Supabase URL, anon key, or service-role key is embedded in the
Android app — see §13.

## 6. Running the backend

```bash
uvicorn app.main:app --reload --port 8000
```

## 7. Swagger / API docs

```
http://localhost:8000/docs        # Swagger UI
http://localhost:8000/redoc       # ReDoc
http://localhost:8000/openapi.json
```

## 8. Mock mode

`MOCK_MODE=true` (the default) makes every AI-backed call deterministic and
free:

- **STT** returns a canned Hindi transcript.
- **Translation** returns a labelled mock translation (or a curated Hindi→
  Santhali sample for the flagship demo sentence).
- **TTS** returns a tiny valid silent WAV so the audio pipeline is
  exercisable end-to-end.
- **LLM** (lesson/quiz/viva generation + viva evaluation) uses a
  template-based generator (`app/services/llm_service.py:MockLLMProvider`)
  that still varies with grade/subject/topic and does genuine semantic-ish
  answer checking (accepts "5", "five", or "three plus two is five" for an
  expected answer of 5 — see `_extract_number`).

This means the frontend and Android app can be fully developed and demoed
without spending any API credits. Flip to real APIs with:

```bash
MOCK_MODE=false
SARVAM_API_KEY=sk_...
LLM_PROVIDER=openai   # or sarvam
LLM_API_KEY=sk_...
```

Ho and Mundari currently have **no confirmed Sarvam language code** (only
Hindi and Santali are documented as supported at the time of writing — see
`app/core/languages.py`). Requests for Ho/Mundari always take the mock
path even with `MOCK_MODE=false` and a valid key, rather than guessing at
an unsupported/invented API parameter. The moment Sarvam documents support,
update `SUPPORTED_LANGUAGES` in `app/core/languages.py` — nothing else
needs to change.

## 9. Real Sarvam configuration

Verified against https://docs.sarvam.ai at the time of writing:

| Endpoint | Method | Auth header |
|---|---|---|
| `POST https://api.sarvam.ai/speech-to-text` | multipart: `file`, `model=saaras:v3`, `mode=transcribe` | `api-subscription-key` |
| `POST https://api.sarvam.ai/translate` | json: `input`, `source_language_code`, `target_language_code`, `mode` | `api-subscription-key` |
| `POST https://api.sarvam.ai/text-to-speech` | json: `text`, `language_code`, `speaker`, `model=bulbul:v3` | `api-subscription-key` |
| `POST https://api.sarvam.ai/v1/chat/completions` | OpenAI-compatible | `api-subscription-key` or `Authorization: Bearer` |

Get a key at https://dashboard.sarvam.ai, set `SARVAM_API_KEY` and
`MOCK_MODE=false`. Re-verify the exact request/response shape against the
live docs before a production launch — APIs evolve.

## 10. API examples

```bash
# Translate
curl -X POST localhost:8000/api/translation \
  -H "Content-Type: application/json" \
  -d '{"text":"तीन और दो कितने होते हैं?","source_language":"hi","target_language":"sat"}'

# Generate a lesson
curl -X POST localhost:8000/api/lessons/generate \
  -H "Content-Type: application/json" \
  -d '{"grade":2,"subject":"Mathematics","topic":"Addition 1-20","teacher_language":"hi","student_language":"sat"}'

# Generate a quiz from that lesson
curl -X POST localhost:8000/api/quizzes/generate \
  -H "Content-Type: application/json" \
  -d '{"lesson_id":"<lesson-id>","number_of_questions":10,"language":"sat","types":["mcq","true_false"]}'

# Start an AI Viva
curl -X POST localhost:8000/api/viva/start \
  -H "Content-Type: application/json" \
  -d '{"student_id":"<student-id>","subject":"Mathematics","topic":"Addition","language":"sat","number_of_questions":5}'
```

Every error response has the same shape:

```json
{"error": {"code": "TRANSLATION_FAILED", "message": "Translation service temporarily unavailable."}}
```

## 11. WebSocket protocol

### `WS /ws/classroom/{session_id}` — the live translation pipeline (two-way)

One WebSocket route, no second pipeline. A teacher connection and a student
connection can both attach to the same `session_id`; whichever side speaks
gets STT'd in its own language, translated to the other side's language,
synthesized, and the result is **broadcast to every connection attached to
that session_id** (not just echoed back to the sender) — so the speaker's
own UI can show "you said X → Y" and the other side's device plays the
translated audio. A single connection (no peer attached yet) behaves
exactly as a lone echo: results go back to that one connection.

Client → server:
- text/JSON: `{"type": "config", "role": "teacher" | "student", "source_language": "hi", "target_language": "sat", "content_type": "audio/webm"}`
  (all fields optional; `role` defaults to `"teacher"` for backward
  compatibility with a single-connection client, and picks default
  source/target languages — hi→sat for teacher, sat→hi for student — that
  an explicit `source_language`/`target_language` in the same message
  overrides. May be sent again mid-session.)
- binary: raw audio bytes for one utterance segment

Server → client, per segment, in order, delivered to **every** connection
attached to the session:
```json
{"type": "transcript",  "text": "...", "language": "hi", "speaker": "teacher", "direction": "teacher_to_student"}
{"type": "translation", "source_language": "hi", "target_language": "sat", "text": "...", "speaker": "teacher", "direction": "teacher_to_student"}
{"type": "audio",       "format": "audio/wav", "data": "<base64>", "speaker": "teacher", "direction": "teacher_to_student"}
{"type": "latency",     "total_ms": 1720, "speaker": "teacher", "direction": "teacher_to_student"}
```
`speaker` is whoever's audio produced this segment; `direction` is always
`<speaker>_to_<other>`, so a receiving client can tell whether a message is
its own outgoing speech or incoming speech to play/display, regardless of
its own role. On failure (sent only to the connection whose segment
failed): `{"type": "error", "message": "..."}`. Latency is real wall-clock
time from receiving the audio frame to emitting the audio response — never
fabricated. The pipeline calls Sarvam's synchronous REST endpoints in
sequence per segment (no LLM call in the hot path) to stay lightweight and
target the ≤3s requirement; swapping in Sarvam's streaming STT protocol
later is a drop-in change inside `app/services/sarvam_service.py`.

The client may also send `"content_type"` in the config message (e.g.
`"audio/webm;codecs=opus"` for a browser, `"audio/mp4"` for Android's
`MediaRecorder`) so the correct format is passed through to Sarvam — real
recorders don't produce WAV. Defaults to `audio/webm` if omitted.

### `WS /ws/student/{student_id}` — push channel to a student device

```json
// client -> server (keepalive)
{"type": "ping"}
// server -> client
{"type": "pong"}
{"type": "notification", "event": "...", "payload": {...}}
```

## 12. Live video pipeline (LiveKit)

**This backend never touches a video frame.** It only issues short-lived,
scoped tokens so the teacher's browser (and eventually the Android app)
connect *directly* to LiveKit's SFU over WebRTC — completely independent of
the AI audio WebSocket above. If video fails, AI audio keeps working; if
Sarvam fails, video keeps working. Neither pipeline can take the other
down.

```
POST /api/classroom/session
  {"teacher_language": "hi", "student_language": "sat"}
  -> {"session_id": "...", "status": "active", ...}

POST /api/classroom/livekit-token
  {"session_id": "...", "participant_type": "teacher" | "student"}
  -> {"token": "...", "url": "wss://...", "room": "classroom-<session_id>"}

POST /api/classroom/session/{id}/end
GET  /api/classroom/session/{id}
```

- The room name is always `classroom-{session_id}` — video and AI audio
  share the same session id as their common handle, per the target
  architecture, without either pipeline depending on the other's state.
- **Teacher** tokens grant `can_publish=true` (camera + mic, an ordinary
  video-call track). **Student** tokens are subscribe-only
  (`can_publish=false`) — students never publish video.
- If `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` aren't set,
  `/api/classroom/livekit-token` returns a typed `503
  LIVEKIT_NOT_CONFIGURED` error rather than a fake token — this is
  independent of `MOCK_MODE`: video is either configured or it isn't,
  regardless of whether AI calls are mocked. The teacher web UI shows
  "Video not configured on this backend" and the AI audio pipeline is
  entirely unaffected.
- Get real credentials from a [LiveKit Cloud](https://cloud.livekit.io)
  project (free tier available) or a self-hosted LiveKit server, then set
  the three env vars above — video lights up with no code changes.

## 13. Android integration instructions

The Android app **must never call Sarvam, the LLM provider, or Supabase/
Postgres directly** — every call goes through this backend:

```
Android → HTTPS/WebSocket → FastAPI → Sarvam / LLM / Supabase Postgres
```

Auth (Student ID + password, no email — see §4a):

- `POST /api/auth/student/login` — returns a bearer session token + profile
- `POST /api/auth/student/register` — demo/admin-only student creation
- `POST /api/auth/student/logout` — revokes the session token
- `GET  /api/auth/student/me` — current student from the bearer token

Retrofit-friendly REST surface (all under `/api/student/{id}/...`, requires
`Authorization: Bearer <token>` for the logged-in student — a token can only
read/write its own student's data):

- `GET  /api/student/{id}` — profile
- `GET  /api/student/{id}/lessons` — assigned lessons (mother-tongue script + activity)
- `GET  /api/student/{id}/quizzes` — assigned quizzes, **correct answers withheld**
- `POST /api/student/{id}/quiz-result?quiz_id=...` — submit answers, get graded
- `POST /api/student/{id}/progress` — record a progress event
- `POST /api/student/{id}/viva` — start an AI Viva for this student
- `POST /api/student/{id}/sync` — offline sync batch (see below)
- `WS   /ws/student/{id}` — realtime push notifications

All response bodies are plain JSON — no custom envelope beyond the
`{"error": {...}}` shape on failure — so a generated Retrofit/Moshi client
works with zero hand-written adapters.

For live video (§12), the Android app would join the same LiveKit room the
teacher published to — call `POST /api/classroom/livekit-token` with
`participant_type: "student"`, connect with the official [LiveKit Android
SDK](https://github.com/livekit/client-sdk-android) using the returned
`url`/`token`, and subscribe to the teacher's video track. AI audio stays on
the separate `WS /ws/classroom/{session_id}` above — never mixed into the
LiveKit room. The Android client itself lives in a separate project and
implementing it was out of scope for this backend/web-app change; the
contract above is what it needs.

## 14. Offline sync

The Android app queues events locally (Room) while offline and flushes them
via `POST /api/sync` (or the per-student `POST /api/student/{id}/sync`):

```json
{
  "student_id": "...",
  "events": [
    {"event_id": "uuid-generated-on-device", "type": "quiz_completed",
     "timestamp": "2026-08-27T10:00:00Z", "payload": {"quiz_id": "...", "score": 8}}
  ]
}
```

```json
{"processed": ["evt-1"], "failed": []}
```

Each `(student_id, event_id)` pair is recorded once in the `sync_events`
table. Re-submitting the same batch after a dropped connection is safe —
already-seen events are reported as processed again without being
re-applied (see `app/services/sync_service.py`).

## 15. Deployment

```bash
docker build -t shikshasetu-backend .
docker run -p 8000:8000 --env-file .env shikshasetu-backend
```

Point `DATABASE_URL` at a managed Postgres instance, set real
`SARVAM_API_KEY` / `LLM_API_KEY`, set `MOCK_MODE=false`,
`ENVIRONMENT=production`, and set `CORS_ORIGINS` to your real frontend
origin(s) — CORS never falls back to `*`.

Generated audio is written to local disk under `media/audio/` and served at
`/media/audio/...` (see `app/core/storage.py`). Mount a persistent volume
there, or swap `save_audio_file()` for an S3/GCS client before deploying
somewhere with an ephemeral filesystem.

---

## Testing

```bash
pytest -v
```

27 tests cover health, translation validation (including the Ho/Mundari
mock-fallback path), lesson generation, quiz generation (teacher view has
`correct_answer`, student view never does), quiz scoring, the full AI Viva
flow including semantic word-form answer matching, student progress, sync
idempotency, the classroom session lifecycle, and LiveKit token issuance in
both the unconfigured (typed 503, never a fake token) and configured
(correct room/grants — teacher can publish, student can't) cases. All tests
run against an isolated SQLite database and mock AI providers — zero
network calls, zero API credits.

## Project layout

```
app/
├── main.py                 FastAPI app, CORS, error handlers, router wiring
├── core/                   config, DB session, language config, exceptions, local storage
├── api/routes/             REST endpoints (health, translation, speech, lessons,
│                           quizzes, viva, students, sync, classroom)
├── api/websocket/          /ws/classroom (AI audio), /ws/student
├── services/                business logic + external API clients
│   ├── sarvam_service.py    STT / translate / TTS (real + mock)
│   ├── llm_service.py       provider-agnostic LLM interface (mock / OpenAI / Sarvam)
│   ├── translation_service.py
│   ├── lesson_service.py
│   ├── quiz_service.py
│   ├── viva_service.py
│   ├── sync_service.py
│   ├── classroom_service.py class session lifecycle
│   └── livekit_service.py   LiveKit token issuance only — never touches media
├── models/                  SQLAlchemy 2.x ORM models (incl. classroom.py: ClassSession)
└── schemas/                  Pydantic request/response models
```
