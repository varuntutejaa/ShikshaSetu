async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ShikshaSetu Backend"
    assert body["mock_mode"] is True
