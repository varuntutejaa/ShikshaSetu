async def test_generate_lesson(client):
    response = await client.post(
        "/api/lessons/generate",
        json={
            "grade": 2,
            "subject": "Mathematics",
            "topic": "Addition 1-20",
            "teacher_language": "hi",
            "student_language": "sat",
            "description": "Teach Class 2 students addition using simple examples.",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "Mathematics"
    assert body["teacher_language"] == "hi"
    assert body["student_language"] == "sat"
    assert len(body["learning_objectives"]) > 0
    assert body["teacher_script"]
    assert body["mother_tongue_script"]
    return body


async def test_get_lesson_after_generation(client):
    create_response = await client.post(
        "/api/lessons/generate",
        json={"grade": 3, "subject": "Hindi", "topic": "Vocabulary", "teacher_language": "hi", "student_language": "sat"},
    )
    lesson_id = create_response.json()["id"]

    response = await client.get(f"/api/lessons/{lesson_id}")
    assert response.status_code == 200
    assert response.json()["id"] == lesson_id


async def test_get_missing_lesson_returns_404(client):
    response = await client.get("/api/lessons/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"


async def test_generate_lesson_audio_and_worksheet(client):
    lesson = (
        await client.post(
            "/api/lessons/generate",
            json={"grade": 2, "subject": "Mathematics", "topic": "Addition", "teacher_language": "hi", "student_language": "sat"},
        )
    ).json()

    audio_response = await client.post(
        f"/api/lessons/{lesson['id']}/audio", json={"language": "sat", "script": "mother_tongue"}
    )
    assert audio_response.status_code == 200
    assert audio_response.json()["content_type"] == "audio"
    assert audio_response.json()["audio_url"].startswith("/media/audio/")

    worksheet_response = await client.post(f"/api/lessons/{lesson['id']}/worksheet?language=hi")
    assert worksheet_response.status_code == 200
    assert worksheet_response.json()["content_type"] == "worksheet"
    assert worksheet_response.json()["text_content"]
