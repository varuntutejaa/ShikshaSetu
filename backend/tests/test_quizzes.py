from app.models.student import Student


async def _create_lesson(client):
    response = await client.post(
        "/api/lessons/generate",
        json={"grade": 2, "subject": "Mathematics", "topic": "Addition 1-20", "teacher_language": "hi", "student_language": "sat"},
    )
    return response.json()


async def test_generate_quiz_teacher_view_includes_correct_answer(client):
    lesson = await _create_lesson(client)

    response = await client.post(
        "/api/quizzes/generate",
        json={
            "lesson_id": lesson["id"],
            "number_of_questions": 10,
            "language": "hi",
            "types": ["mcq", "true_false", "fill_in_blank"],
            "difficulty": "medium",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body["questions"]) == 10
    assert all("correct_answer" in q and q["correct_answer"] for q in body["questions"])
    return body


async def test_student_view_hides_correct_answer(client):
    lesson = await _create_lesson(client)
    quiz = (
        await client.post(
            "/api/quizzes/generate",
            json={"lesson_id": lesson["id"], "number_of_questions": 5, "language": "hi"},
        )
    ).json()

    response = await client.get(f"/api/quizzes/{quiz['id']}/student-view")
    assert response.status_code == 200
    body = response.json()
    assert len(body["questions"]) == 5
    for question in body["questions"]:
        assert "correct_answer" not in question


async def test_quiz_attempt_scoring(client, db_session):
    student = Student(name="Ravi Hansda", mother_tongue="sat", grade=2)
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)

    lesson = await _create_lesson(client)
    quiz = (
        await client.post(
            "/api/quizzes/generate",
            json={"lesson_id": lesson["id"], "number_of_questions": 3, "language": "hi"},
        )
    ).json()

    answers = [
        {"question_id": q["id"], "student_answer": q["correct_answer"]} for q in quiz["questions"]
    ]

    response = await client.post(
        f"/api/quizzes/{quiz['id']}/attempt",
        json={"student_id": str(student.id), "answers": answers},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 3
    assert body["total"] == 3
