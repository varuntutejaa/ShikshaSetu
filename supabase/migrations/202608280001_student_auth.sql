-- Student login credentials + server-side sessions.
--
-- Additive/data-preserving migration for Supabase PostgreSQL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS student_code VARCHAR(32),
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS ix_students_student_code ON students (student_code);

CREATE TABLE IF NOT EXISTS student_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_student_sessions_token_hash ON student_sessions (token_hash);
CREATE INDEX IF NOT EXISTS ix_student_sessions_student_id ON student_sessions (student_id);
