"""Student auth: register (demo/admin) -> login -> protected routes -> logout."""

from app.core.security import hash_password
from app.models.student import Student


async def _create_student_with_password(db_session, student_code: str, password: str = "student123") -> Student:
    student = Student(
        name="Birsa Murmu",
        mother_tongue="sat",
        grade=2,
        school="Govt Primary School",
        student_code=student_code,
        password_hash=hash_password(password),
    )
    db_session.add(student)
    await db_session.commit()
    await db_session.refresh(student)
    return student


async def _login(client, student_code: str, password: str = "student123"):
    return await client.post(
        "/api/auth/student/login", json={"student_id": student_code, "password": password}
    )


# --- Registration -------------------------------------------------------------------------------


async def test_register_creates_student_and_logs_in(client):
    response = await client.post(
        "/api/auth/student/register",
        json={
            "student_id": "STU2001",
            "password": "student123",
            "name": "New Student",
            "grade": 3,
            "mother_tongue": "sat",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["student"]["student_code"] == "STU2001"
    assert body["student"]["name"] == "New Student"
    assert "password" not in body["student"]
    assert "password_hash" not in body["student"]


async def test_register_duplicate_student_id_conflicts(client, db_session):
    await _create_student_with_password(db_session, "STU2002")
    response = await client.post(
        "/api/auth/student/register",
        json={"student_id": "STU2002", "password": "whatever1", "name": "Someone Else", "grade": 2},
    )
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "CONFLICT"


# --- Login ----------------------------------------------------------------------------------


async def test_login_success_returns_token_and_profile(client, db_session):
    student = await _create_student_with_password(db_session, "STU3001")
    response = await _login(client, "STU3001")
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["student"]["id"] == str(student.id)
    assert body["student"]["student_code"] == "STU3001"


async def test_login_wrong_password_rejected(client, db_session):
    await _create_student_with_password(db_session, "STU3002")
    response = await _login(client, "STU3002", password="wrong-password")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


async def test_login_unknown_student_id_rejected_with_same_error(client):
    response = await _login(client, "STU9999")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"


# --- Protected student-app routes -----------------------------------------------------------


async def test_student_profile_requires_auth(client, db_session):
    student = await _create_student_with_password(db_session, "STU4001")
    response = await client.get(f"/api/student/{student.id}")
    assert response.status_code == 401


async def test_student_profile_rejects_mismatched_token(client, db_session):
    student_a = await _create_student_with_password(db_session, "STU4002")
    await _create_student_with_password(db_session, "STU4003")
    login = await _login(client, "STU4003")
    token = login.json()["token"]

    response = await client.get(
        f"/api/student/{student_a.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


async def test_student_profile_succeeds_with_own_token(client, db_session):
    student = await _create_student_with_password(db_session, "STU4004")
    login = await _login(client, "STU4004")
    token = login.json()["token"]

    response = await client.get(
        f"/api/student/{student.id}", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["id"] == str(student.id)


# --- Logout -----------------------------------------------------------------------------------


async def test_logout_revokes_session(client, db_session):
    student = await _create_student_with_password(db_session, "STU5001")
    login = await _login(client, "STU5001")
    token = login.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert (await client.get(f"/api/student/{student.id}", headers=headers)).status_code == 200

    logout_response = await client.post("/api/auth/student/logout", headers=headers)
    assert logout_response.status_code == 204

    after_logout = await client.get(f"/api/student/{student.id}", headers=headers)
    assert after_logout.status_code == 401
