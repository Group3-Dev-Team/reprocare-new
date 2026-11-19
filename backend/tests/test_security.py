"""v2.0 hardening: password length, sign-in throttling, session revocation and response headers."""

from app.services import rate_limit


def _register(client, email, password="Secret123"):
    r = client.post("/api/auth/register", json={"full_name": "Security Test", "email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_password_longer_than_bcrypt_limit_is_rejected_cleanly(client):
    r = client.post("/api/auth/register", json={"full_name": "Long Pass", "email": "longpass@example.com", "password": "a1" * 40})
    assert r.status_code == 422


def test_repeated_failed_sign_ins_are_throttled(client):
    email = "throttle@example.com"
    _register(client, email)
    try:
        for _ in range(rate_limit.MAX_FAILURES_PER_ACCOUNT):
            assert client.post("/api/auth/login", json={"email": email, "password": "wrong-1"}).status_code == 401
        blocked = client.post("/api/auth/login", json={"email": email, "password": "Secret123"})
        assert blocked.status_code == 429
    finally:
        rate_limit.reset(f"email:{email}", "ip:testclient")
    assert client.post("/api/auth/login", json={"email": email, "password": "Secret123"}).status_code == 200


def test_unknown_email_gets_the_same_error_as_a_wrong_password(client):
    r = client.post("/api/auth/login", json={"email": "nobody-here@example.com", "password": "whatever1"})
    wrong = client.post("/api/auth/login", json={"email": "patient@reprocare.demo", "password": "whatever1"})
    # same message for unknown account and wrong password (message mentions phone now)
    assert r.status_code == wrong.status_code == 401 and r.json()["detail"] == wrong.json()["detail"] == "The email, phone number or password is incorrect."
    rate_limit.reset("email:nobody-here@example.com", "email:patient@reprocare.demo", "ip:testclient")


def test_changing_password_signs_out_other_devices_only(client):
    email = "rotate@example.com"
    first = _register(client, email)
    r = client.post("/api/auth/login", json={"email": email, "password": "Secret123"})
    second = {"Authorization": f"Bearer {r.json()['token']}"}
    r = client.post("/api/auth/change-password", headers=first, json={"current_password": "Secret123", "new_password": "Newer4567"})
    assert r.status_code == 204
    assert client.get("/api/auth/me", headers=first).status_code == 200
    assert client.get("/api/auth/me", headers=second).status_code == 401


def test_new_password_must_differ(client):
    headers = _register(client, "same@example.com")
    r = client.post("/api/auth/change-password", headers=headers, json={"current_password": "Secret123", "new_password": "Secret123"})
    assert r.status_code == 400


def test_sign_out_everywhere(client):
    headers = _register(client, "everywhere@example.com")
    assert client.post("/api/auth/logout-all", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_security_headers_present(client):
    r = client.get("/api/services")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"