import re

from app.models.student import Student


async def _create_student(db_session) -> Student:
    student = Student(name="Sunita Munda", mother_tongue="sat", grade=2)
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


def _expected_sum(question: str) -> int:
    a, b = re.search(r"(\d+)\s*\+\s*(\d+)", question).groups()
    return int(a) + int(b)


async def test_full_viva_flow(client, db_session):
    student = await _create_student(db_session)

    start_response = await client.post(
        "/api/viva/start",
        json={
            "student_id": str(student.id),
            "subject": "Mathematics",
            "topic": "Addition 1-20",
            "language": "sat",
            "number_of_questions": 2,
        },
    )
    assert start_response.status_code == 200
    session = start_response.json()
    assert session["status"] == "in_progress"
    first_question = session["first_question"]

    expected = _expected_sum(first_question["question"])
    answer_response = await client.post(
        f"/api/viva/{session['id']}/answer",
        json={"question_id": first_question["id"], "student_answer_text": str(expected)},
    )
    assert answer_response.status_code == 200
    result = answer_response.json()
    assert result["correct"] is True
    assert result["is_last_question"] is False
    assert result["next_question"] is not None

    next_question = result["next_question"]
    expected_2 = _expected_sum(next_question["question"])
    answer_response_2 = await client.post(
        f"/api/viva/{session['id']}/answer",
        json={"question_id": next_question["id"], "student_answer_text": "not a number at all"},
    )
    assert answer_response_2.status_code == 200
    result_2 = answer_response_2.json()
    assert result_2["is_last_question"] is True
    assert result_2["correct"] is False

    complete_response = await client.post(f"/api/viva/{session['id']}/complete")
    assert complete_response.status_code == 200
    report = complete_response.json()
    assert report["score"] == 1
    assert report["total"] == 2
    assert len(report["recommended_interventions"]) >= 1


async def test_viva_semantic_answer_word_form(client, db_session):
    """Accept 'five' for an expected numeric answer of 5, not just the digit."""
    student = await _create_student(db_session)
    start_response = await client.post(
        "/api/viva/start",
        json={
            "student_id": str(student.id),
            "subject": "Mathematics",
            "topic": "Addition",
            "language": "sat",
            "number_of_questions": 1,
        },
    )
    session = start_response.json()
    question = session["first_question"]
    expected = _expected_sum(question["question"])

    word_map = {
        0: "zero", 1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
        6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
        11: "eleven", 12: "twelve", 13: "thirteen",
    }
    answer_text = word_map.get(expected, str(expected))

    response = await client.post(
        f"/api/viva/{session['id']}/answer",
        json={"question_id": question["id"], "student_answer_text": f"I think it is {answer_text}"},
    )
    assert response.status_code == 200
    assert response.json()["correct"] is True
