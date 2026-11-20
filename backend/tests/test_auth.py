from tests.conftest import auth_headers


def test_register_login_me_logout(client):
    r = client.post("/api/auth/register", json={"full_name": "Amina Hassan", "email": "Amina@Example.com", "password": "Passw0rd!"})
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "patient"
    assert r.json()["user"]["email"] == "amina@example.com"

    headers = auth_headers(client, "amina@example.com", "Passw0rd!")
    me = client.get("/api/auth/me", headers=headers)
    assert me.status_code == 200 and me.json()["full_name"] == "Amina Hassan"

    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    # The token no longer works after logout: the session row is gone.
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_duplicate_email_rejected(client):
    body = {"full_name": "Someone", "email": "dup@example.com", "password": "Passw0rd1"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    assert client.post("/api/auth/register", json=body).status_code == 409


def test_weak_password_and_bad_email_rejected(client):
    assert client.post("/api/auth/register", json={"full_name": "A B", "email": "x@example.com", "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json={"full_name": "A B", "email": "not-an-email", "password": "Passw0rd1"}).status_code == 422


def test_invalid_credentials(client):
    r = client.post("/api/auth/login", json={"email": "patient@reprocare.demo", "password": "wrong"})
    assert r.status_code == 401
    assert "incorrect" in r.json()["detail"]
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "whatever"}).status_code == 401


def test_password_is_hashed_and_change_password(client, new_patient):
    headers, user = new_patient
    from app.database.session import SessionLocal
    from app.models import User

    with SessionLocal() as db:
        stored = db.get(User, user["id"])
        assert stored.password_hash.startswith("$2") and "Secret123" not in stored.password_hash
    assert client.post("/api/auth/change-password", headers=headers, json={"current_password": "nope", "new_password": "NewPass123"}).status_code == 400
    assert client.post("/api/auth/change-password", headers=headers, json={"current_password": "Secret123", "new_password": "NewPass123"}).status_code == 204
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "NewPass123"}).status_code == 200


def test_public_registration_cannot_choose_role(client):
    r = client.post("/api/auth/register", json={"full_name": "Sneaky", "email": "sneaky@example.com", "password": "Passw0rd1", "role": "admin"})
    assert r.status_code == 201 and r.json()["user"]["role"] == "patient"


def test_deactivated_account_cannot_sign_in(client, admin_headers, new_patient):
    _, user = new_patient
    assert client.patch(f"/api/admin/users/{user['id']}", headers=admin_headers, json={"is_active": False}).status_code == 200
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "Secret123"}).status_code == 403
