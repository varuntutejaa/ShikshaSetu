async def test_teacher_demo_login_and_me(client):
    response = await client.post("/api/auth/teacher/demo")
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["teacher"]["email"] == "demo"

    me = await client.get(
        "/api/auth/teacher/me",
        headers={"Authorization": f"Bearer {body['token']}"},
    )
    assert me.status_code == 200
    assert me.json()["id"] == body["teacher"]["id"]


async def test_teacher_signup_login_and_logout(client):
    signup = await client.post(
        "/api/auth/teacher/register",
        json={
            "name": "Anita Kumari",
            "email": "anita@example.test",
            "password": "teacher123",
            "school_name": "Government Primary School",
        },
    )
    assert signup.status_code == 200

    login = await client.post(
        "/api/auth/teacher/login",
        json={"email": "ANITA@example.test", "password": "teacher123"},
    )
    assert login.status_code == 200
    token = login.json()["token"]

    logout = await client.post(
        "/api/auth/teacher/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout.status_code == 204

    me = await client.get("/api/auth/teacher/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 401


async def test_teacher_duplicate_signup_conflicts(client):
    payload = {
        "name": "Teacher One",
        "email": "duplicate@example.test",
        "password": "teacher123",
    }
    assert (await client.post("/api/auth/teacher/register", json=payload)).status_code == 200
    response = await client.post("/api/auth/teacher/register", json=payload)
    assert response.status_code == 409
