async def test_translate_hindi_to_santhali(client):
    response = await client.post(
        "/api/translation",
        json={"text": "तीन और दो", "source_language": "hi", "target_language": "sat"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["source_language"] == "hi"
    assert body["target_language"] == "sat"
    assert body["translated_text"]
    assert body["provider"] == "mock"


async def test_translate_rejects_unsupported_language(client):
    response = await client.post(
        "/api/translation",
        json={"text": "hello", "source_language": "hi", "target_language": "fr"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_translate_ho_falls_back_to_mock_provider(client):
    """Ho has no confirmed Sarvam language code — must never silently error."""
    response = await client.post(
        "/api/translation",
        json={"text": "नमस्ते", "source_language": "hi", "target_language": "ho"},
    )
    assert response.status_code == 200
    assert response.json()["provider"] == "mock"
