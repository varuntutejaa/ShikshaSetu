-- Baseline FastAPI/SQLAlchemy schema for Supabase PostgreSQL.
-- Non-destructive: creates missing tables/indexes only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS teachers (
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    phone VARCHAR(32),
    school_name VARCHAR(255),
    default_teacher_language VARCHAR(8) NOT NULL,
    default_student_language VARCHAR(8) NOT NULL,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS classes (
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    name VARCHAR(160),
    class_code VARCHAR(12) NOT NULL,
    grade INTEGER NOT NULL,
    section VARCHAR(16),
    subject_focus VARCHAR(120),
    teacher_language VARCHAR(8) NOT NULL,
    student_language VARCHAR(8) NOT NULL,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_classes_class_code ON classes (class_code);

CREATE TABLE IF NOT EXISTS lessons (
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    grade INTEGER NOT NULL,
    subject VARCHAR(120) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    teacher_language VARCHAR(8) NOT NULL,
    student_language VARCHAR(8) NOT NULL,
    learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
    teacher_script TEXT NOT NULL,
    mother_tongue_script TEXT NOT NULL,
    activity TEXT NOT NULL,
    assessment_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
    downloadable BOOLEAN NOT NULL DEFAULT false,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS students (
    name VARCHAR(255) NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    student_code VARCHAR(32),
    password_hash VARCHAR(255),
    mother_tongue VARCHAR(8) NOT NULL,
    grade INTEGER NOT NULL,
    school VARCHAR(255),
    points INTEGER NOT NULL DEFAULT 120,
    streak_days INTEGER NOT NULL DEFAULT 4,
    attendance FLOAT NOT NULL DEFAULT 0,
    reading_score FLOAT NOT NULL DEFAULT 0,
    numeracy_score FLOAT NOT NULL DEFAULT 0,
    vocabulary_score FLOAT NOT NULL DEFAULT 0,
    overall_score FLOAT NOT NULL DEFAULT 0,
    risk_level VARCHAR(16) NOT NULL DEFAULT 'Low',
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ix_students_student_code ON students (student_code);

CREATE TABLE IF NOT EXISTS class_sessions (
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    teacher_language VARCHAR(8) NOT NULL,
    student_language VARCHAR(8) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    ended_at TIMESTAMPTZ,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    current_slide_index INTEGER NOT NULL DEFAULT 0,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS lesson_content (
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    content_type VARCHAR(32) NOT NULL,
    language VARCHAR(8) NOT NULL,
    text_content TEXT,
    audio_url VARCHAR(512),
    metadata JSONB,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS quizzes (
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title VARCHAR(255),
    language VARCHAR(8) NOT NULL,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS student_progress (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    competency VARCHAR(120),
    score FLOAT,
    extra_data JSONB,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS student_sessions (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_student_sessions_student_id ON student_sessions (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_student_sessions_token_hash ON student_sessions (token_hash);

CREATE TABLE IF NOT EXISTS teacher_sessions (
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_teacher_sessions_teacher_id ON teacher_sessions (teacher_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_teacher_sessions_token_hash ON teacher_sessions (token_hash);

CREATE TABLE IF NOT EXISTS sync_events (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(16) NOT NULL DEFAULT 'processed',
    error_message TEXT,
    occurred_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CONSTRAINT uq_sync_student_event UNIQUE (student_id, event_id)
);

CREATE TABLE IF NOT EXISTS viva_sessions (
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    subject VARCHAR(120) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    language VARCHAR(8) NOT NULL,
    num_questions INTEGER NOT NULL,
    status VARCHAR(16) NOT NULL,
    score INTEGER,
    total INTEGER,
    strengths JSONB,
    weaknesses JSONB,
    recommended_interventions JSONB,
    completed_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS class_session_participants (
    session_id UUID NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE SET NULL,
    participant_type VARCHAR(16) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'online',
    joined_at TIMESTAMPTZ NOT NULL,
    left_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_class_session_participants_session_id ON class_session_participants (session_id);
CREATE INDEX IF NOT EXISTS ix_class_session_participants_student_id ON class_session_participants (student_id);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    completed_at TIMESTAMPTZ,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    question_type VARCHAR(32) NOT NULL,
    difficulty VARCHAR(16) NOT NULL,
    competency VARCHAR(120) NOT NULL,
    explanation TEXT,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS viva_questions (
    viva_session_id UUID NOT NULL REFERENCES viva_sessions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    competency VARCHAR(120),
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS viva_answers (
    viva_question_id UUID NOT NULL UNIQUE REFERENCES viva_questions(id) ON DELETE CASCADE,
    student_answer_text TEXT NOT NULL,
    correct BOOLEAN NOT NULL,
    score FLOAT NOT NULL,
    confidence FLOAT NOT NULL,
    feedback TEXT,
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);
