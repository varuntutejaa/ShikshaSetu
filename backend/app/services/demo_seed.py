"""Deterministic demo data used by the web and Android apps in mock mode."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ClassModel, Lesson, Quiz, QuizQuestion, Student, Teacher

DEMO_TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
DEMO_CLASS_ID = uuid.UUID("00000000-0000-0000-0000-000000000010")
DEMO_STUDENT_ID = uuid.UUID("00000000-0000-0000-0000-000000000002")


DEMO_LESSONS = [
    ("Numbers 1-20", "Math", "Count, read, and compare numbers from 1 to 20."),
    ("Basic Addition", "Math", "Add small groups of objects using everyday examples."),
    ("Animals", "EVS", "Identify common animals and the sounds they make."),
    ("My Family", "EVS", "Talk about family members and how they help each other."),
    ("Simple Words", "English", "Read and speak common classroom words with confidence."),
]


async def seed_demo_data(db: AsyncSession) -> None:
    existing = await db.get(Student, DEMO_STUDENT_ID)
    if existing is not None:
        return

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
            grade=2,
            section="A",
            subject_focus="Foundational Literacy and Numeracy",
            teacher_language="hi",
            student_language="sat",
        )
        db.add(class_ref)

    student = Student(
        id=DEMO_STUDENT_ID,
        name="Rahul",
        class_id=DEMO_CLASS_ID,
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
    result = await db.execute(
        select(Student)
        .where(Student.id == DEMO_STUDENT_ID)
        .options(selectinload(Student.class_ref))
    )
    if result.scalar_one_or_none() is None:
        await seed_demo_data(db)
