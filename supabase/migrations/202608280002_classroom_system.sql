-- Classroom codes, sessions, presence, synchronized content and offline-pack metadata.
--
-- Additive/data-preserving migration for Supabase PostgreSQL.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE classes
    ADD COLUMN IF NOT EXISTS name VARCHAR(160),
    ADD COLUMN IF NOT EXISTS class_code VARCHAR(12);

UPDATE classes
SET class_code = UPPER(SUBSTRING(REPLACE(id::text, '-', ''), 1, 6))
WHERE class_code IS NULL;

ALTER TABLE classes
    ALTER COLUMN class_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_classes_class_code ON classes (class_code);

CREATE TABLE IF NOT EXISTS class_session_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    participant_type VARCHAR(16) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'online',
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_class_session_participants_session_id
    ON class_session_participants (session_id);

CREATE INDEX IF NOT EXISTS ix_class_session_participants_student_id
    ON class_session_participants (student_id);

ALTER TABLE class_sessions
    ADD COLUMN IF NOT EXISTS lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS current_slide_index INTEGER NOT NULL DEFAULT 0;

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS downloadable BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE lesson_content
    ADD COLUMN IF NOT EXISTS metadata JSONB;
