-- Teacher login credentials + server-side sessions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE teachers
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE TABLE IF NOT EXISTS teacher_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_teacher_sessions_token_hash ON teacher_sessions (token_hash);
CREATE INDEX IF NOT EXISTS ix_teacher_sessions_teacher_id ON teacher_sessions (teacher_id);
