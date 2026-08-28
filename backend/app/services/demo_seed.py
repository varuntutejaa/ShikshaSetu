"""Deterministic demo data used by the web and Android apps in mock mode."""

from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import ClassModel, Lesson, Quiz, QuizQuestion, Student, Teacher

DEMO_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
DEMO_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")

# --- Demo login credentials --------------------------------------------------
# Clearly-marked demo-only credentials, seeded so the Android login screen has
# something to test against. Never used in a real deployment with real
# students — see README "Demo student logins".
DEMO_PASSWORD = "student123"  # noqa: S105 - intentional demo credential, not a secret
DEMO_LOGIN_STUDENTS = [
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000006"),
        "code": "STU1001",
        "name": "Sita Hansda",
        "points": 90,
        "streak_days": 2,
        "attendance": 88.0,
        "reading_score": 70.0,
        "numeracy_score": 65.0,
        "vocabulary_score": 72.0,
    },
    {
        "id": uuid.UUID("00000000-0000-0000-0000-000000000007"),
        "code": "STU1002",
        "name": "Amit Murmu",
        "points": 150,
        "streak_days": 6,
        "attendance": 95.0,
        "reading_score": 85.0,
        "numeracy_score": 90.0,
        "vocabulary_score": 80.0,
    },
]


DEMO_LESSONS = [
    ("Numbers 1-20", "Math", "Count, read, and compare numbers from 1 to 20."),
    ("Basic Addition", "Math", "Add small groups of objects using everyday examples."),
    ("Animals", "EVS", "Identify common animals and the sounds they make."),
    ("My Family", "EVS", "Talk about family members and how they help each other."),
    ("Simple Words", "English", "Read and speak common classroom words with confidence."),
]


async def seed_demo_data(db: AsyncSession) -> None:
    """Idempotent: safe to call on every startup. Creates each demo entity
    only if missing, and backfills login credentials onto a pre-existing
    demo student that predates auth (e.g. an already-deployed database)."""
    password_hash = hash_password(DEMO_PASSWORD)

    teacher = await db.get(Teacher, DEMO_TEACHER_ID)
    if teacher is None:
        teacher = Teacher(
            id=DEMO_TEACHER_ID,
            name="Demo Teacher",
            email="teacher@shikshasetu.local",
            school_name="Government Primary School",
            default_teacher_language="hi",
            default_student_language="sat",
        )
        db.add(teacher)

    class_ref = await db.get(ClassModel, DEMO_CLASS_ID)
    if class_ref is None:
        class_ref = ClassModel(
            id=DEMO_CLASS_ID,
            teacher_id=DEMO_TEACHER_ID,
            name="Class 2A Mathematics",
            class_code="DEMO2A",
            grade=2,
            section="A",
            subject_focus="Foundational Literacy and Numeracy",
            teacher_language="hi",
            student_language="sat",
        )
        db.add(class_ref)

    student = await db.get(Student, DEMO_STUDENT_ID)
    if student is None:
        student = Student(
            id=DEMO_STUDENT_ID,
            name="Rahul",
            class_id=DEMO_CLASS_ID,
            student_code="STU1000",
            password_hash=password_hash,
            mother_tongue="sat",
            grade=2,
            school="Government Primary School",
            points=120,
            streak_days=4,
            attendance=92.0,
            reading_score=78.0,
            numeracy_score=82.0,
            vocabulary_score=74.0,
        )
        student.recompute_overall()
        db.add(student)
    elif student.student_code is None or student.password_hash is None:
        student.student_code = student.student_code or "STU1000"
        student.password_hash = student.password_hash or password_hash

    for spec in DEMO_LOGIN_STUDENTS:
        login_student = await db.get(Student, spec["id"])
        if login_student is None:
            login_student = Student(
                id=spec["id"],
                name=spec["name"],
                class_id=DEMO_CLASS_ID,
                student_code=spec["code"],
                password_hash=password_hash,
                mother_tongue="sat",
                grade=2,
                school="Government Primary School",
                points=spec["points"],
                streak_days=spec["streak_days"],
                attendance=spec["attendance"],
                reading_score=spec["reading_score"],
                numeracy_score=spec["numeracy_score"],
                vocabulary_score=spec["vocabulary_score"],
            )
            login_student.recompute_overall()
            db.add(login_student)
        elif login_student.student_code is None or login_student.password_hash is None:
            login_student.student_code = login_student.student_code or spec["code"]
            login_student.password_hash = login_student.password_hash or password_hash

    if await db.get(Lesson, uuid.UUID("00000000-0000-0000-0000-000000000101")) is not None:
        await db.commit()
        return

    for index, (topic, subject, objective) in enumerate(DEMO_LESSONS, start=1):
        lesson = Lesson(
            id=uuid.UUID(f"00000000-0000-0000-0000-{100 + index:012d}"),
            teacher_id=DEMO_TEACHER_ID,
            class_id=DEMO_CLASS_ID,
            grade=2,
            subject=subject,
            topic=topic,
            teacher_language="hi",
            student_language="sat",
            learning_objectives=[objective],
            teacher_script=f"Introduce {topic} with a short story and classroom objects.",
            mother_tongue_script=f"Mock Santhali support for {topic}.",
            activity=f"Ask Rahul to complete one quick practice activity for {topic}.",
            assessment_topics=[topic],
        )
        db.add(lesson)

    quiz = Quiz(
        id=uuid.UUID("00000000-0000-0000-0000-000000000201"),
        lesson_id=uuid.UUID("00000000-0000-0000-0000-000000000102"),
        title="Basic Addition Quick Check",
        language="sat",
    )
    quiz.questions = [
        QuizQuestion(
            id=uuid.UUID("00000000-0000-0000-0000-000000000301"),
            order_index=1,
            question="What is 2 + 3?",
            options=["4", "5", "6", "7"],
            correct_answer="5",
            question_type="mcq",
            difficulty="easy",
            competency="numeracy",
            explanation="Two objects and three more objects make five.",
        ),
        QuizQuestion(
            id=uuid.UUID("00000000-0000-0000-0000-000000000302"),
            order_index=2,
            question="What is 1 + 1?",
            options=["1", "2", "3", "4"],
            correct_answer="2",
            question_type="mcq",
            difficulty="easy",
            competency="numeracy",
            explanation="One and one together make two.",
        ),
    ]
    db.add(quiz)
    await db.commit()


async def ensure_demo_data(db: AsyncSession) -> None:
    """seed_demo_data is itself idempotent (per-entity get-or-create/backfill),
    so this is just a readable alias called from the app startup lifespan."""
    await seed_demo_data(db)
