"""Seed the demo dataset shown in the ShikshaSetu teacher frontend.

Run once against whatever DATABASE_URL is configured:

    python -m scripts.seed_demo_data

Every id here is a **fixed** UUID (not randomly generated) so the frontend
can reference these exact students when calling the real backend — see
`STUDENT_BACKEND_IDS` in `src/lib/mock-data.ts`, which must stay in sync
with the ids below. Safe to re-run: existing rows are left untouched.
"""

import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import AsyncSessionLocal, init_models  # noqa: E402
from app.models.class_model import ClassModel  # noqa: E402
from app.models.student import Student  # noqa: E402
from app.models.teacher import Teacher  # noqa: E402

TEACHER_ID = uuid.UUID("00000000-0000-0000-0000-0000000000a1")
CLASS_ID = uuid.UUID("00000000-0000-0000-0000-0000000000c2")
SCHOOL_NAME = "Government Primary School, West Singhbhum"

# Keep in lockstep with STUDENT_BACKEND_IDS in src/lib/mock-data.ts
STUDENTS = [
    {
        "id": uuid.UUID("1971e296-1289-4a1a-ba2c-2f76c5db5435"),
        "name": "Sunita Munda", "mother_tongue": "sat",
        "attendance": 94, "reading_score": 82, "numeracy_score": 75, "vocabulary_score": 80,
    },
    {
        "id": uuid.UUID("4dda0719-553c-4f9e-9c7b-1346d914035a"),
        "name": "Ravi Hansda", "mother_tongue": "sat",
        "attendance": 88, "reading_score": 60, "numeracy_score": 48, "vocabulary_score": 55,
    },
    {
        "id": uuid.UUID("735178f3-f6cc-4176-889b-facef7c00636"),
        "name": "Priya Kumari", "mother_tongue": "hi",
        "attendance": 97, "reading_score": 90, "numeracy_score": 88, "vocabulary_score": 92,
    },
    {
        "id": uuid.UUID("431377a2-48f1-44a7-9fca-a36cc156e915"),
        "name": "Birsa Murmu", "mother_tongue": "sat",
        "attendance": 79, "reading_score": 55, "numeracy_score": 62, "vocabulary_score": 50,
    },
    {
        "id": uuid.UUID("98bf2b27-fb12-44a6-b437-c46d785539a0"),
        "name": "Kavita Devi", "mother_tongue": "ho",
        "attendance": 91, "reading_score": 74, "numeracy_score": 70, "vocabulary_score": 72,
    },
    {
        "id": uuid.UUID("661ee643-ec6d-44e4-bba5-ae5e4f345150"),
        "name": "Suraj Tudu", "mother_tongue": "sat",
        "attendance": 85, "reading_score": 68, "numeracy_score": 58, "vocabulary_score": 65,
    },
    {
        "id": uuid.UUID("a22ba81c-0a1b-4c08-b8e9-dcb531cd2134"),
        "name": "Anjali Oraon", "mother_tongue": "unr",
        "attendance": 96, "reading_score": 85, "numeracy_score": 80, "vocabulary_score": 83,
    },
    {
        "id": uuid.UUID("c1506c73-7a7b-409d-8a92-072a402e7ca3"),
        "name": "Mangal Soren", "mother_tongue": "sat",
        "attendance": 81, "reading_score": 58, "numeracy_score": 52, "vocabulary_score": 60,
    },
]


async def main() -> None:
    await init_models()

    async with AsyncSessionLocal() as session:
        if await session.get(Teacher, TEACHER_ID) is None:
            session.add(
                Teacher(
                    id=TEACHER_ID,
                    name="Anita Kumari",
                    school_name=SCHOOL_NAME,
                    default_teacher_language="hi",
                    default_student_language="sat",
                )
            )

        if await session.get(ClassModel, CLASS_ID) is None:
            session.add(
                ClassModel(
                    id=CLASS_ID,
                    teacher_id=TEACHER_ID,
                    grade=2,
                    subject_focus="Mathematics",
                    teacher_language="hi",
                    student_language="sat",
                )
            )

        created = 0
        for data in STUDENTS:
            if await session.get(Student, data["id"]) is not None:
                continue
            student = Student(
                id=data["id"],
                name=data["name"],
                class_id=CLASS_ID,
                mother_tongue=data["mother_tongue"],
                grade=2,
                school=SCHOOL_NAME,
                attendance=data["attendance"],
                reading_score=data["reading_score"],
                numeracy_score=data["numeracy_score"],
                vocabulary_score=data["vocabulary_score"],
            )
            student.recompute_overall()
            session.add(student)
            created += 1

        await session.commit()
        print(f"Seed complete — {created} new student(s) created (of {len(STUDENTS)} total).")


if __name__ == "__main__":
    asyncio.run(main())
