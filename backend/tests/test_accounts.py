"""Tests for phone sign-in, password reset and deleting an account."""

import hashlib
import itertools
import re
from datetime import date, datetime, timedelta, timezone

import pytest

from app.database.session import SessionLocal
from app.models import AppointmentRequest, PasswordResetToken, ProgramRegistration, Review, User, UserSession
from app.routes import auth_routes
from app.services import mailer_service, rate_limit

_n = itertools.count(1)


@pytest.fixture()
def account(client):
    """a new patient with a known email, phone and password"""
    n = next(_n)
    email, phone, password = f"acct{n}@example.com", f"07220{n:05d}", "Original1pass"
    r = client.post("/api/auth/register", json={"full_name": f"Account Owner {n}", "email": email, "password": password, "phone": phone})
    assert r.status_code == 201, r.text
    return {"email": email, "phone": phone, "password": password, "token": r.json()["token"], "user": r.json()["user"]}


@pytest.fixture()
def outbox(monkeypatch):
    """catch the reset emails instead of sending them"""
    sent = []
    monkeypatch.setattr(mailer_service, "send_email", lambda to, subject, body: sent.append({"to": to, "subject": subject, "body": body}) or True)
    return sent


@pytest.fixture(autouse=True)
def fresh_limits():
    rate_limit._attempts.clear()
    yield
    rate_limit._attempts.clear()


def _token_from(mail) -> str:
    return re.search(r"token=([\w-]+)", mail["body"]).group(1)


# ---- phone sign-in ----

def test_sign_in_with_phone_in_any_kenyan_format(client, account):
    local = account["phone"]
    for form in (local, f"+254{local[1:]}", f"{local[:4]} {local[4:7]} {local[7:]}"):
        r = client.post("/api/auth/login", json={"identifier": form, "password": account["password"]})
        assert r.status_code == 200, (form, r.text)
        assert r.json()["user"]["email"] == account["email"]
    # old website still sends "email"
    assert client.post("/api/auth/login", json={"email": account["email"], "password": account["password"]}).status_code == 200
    wrong = client.post("/api/auth/login", json={"identifier": local, "password": "nope"})
    assert wrong.status_code == 401 and wrong.json()["detail"] == "The email, phone number or password is incorrect."


def test_phone_is_stored_normalised_and_must_be_unique(client, account):
    assert account["user"]["phone"] == f"+254{account['phone'][1:]}"
    taken = client.post("/api/auth/register", json={"full_name": "Copy Cat", "email": "copycat@example.com", "password": "Passw0rd1", "phone": account["phone"]})
    assert taken.status_code == 409 and "phone number" in taken.json()["detail"]
    other = client.post("/api/auth/register", json={"full_name": "Other One", "email": "other.one@example.com", "password": "Passw0rd1"}).json()
    clash = client.patch("/api/auth/me", headers={"Authorization": f"Bearer {other['token']}"}, json={"full_name": "Other One", "phone": f"+254 {account['phone'][1:]}"})
    assert clash.status_code == 409
    # many accounts can have no phone
    assert client.post("/api/auth/register", json={"full_name": "No Phone", "email": "nophone@example.com", "password": "Passw0rd1"}).status_code == 201


def test_demo_patient_can_sign_in_with_phone(client):
    assert client.post("/api/auth/login", json={"identifier": "0700 000 001", "password": "Patient#2026"}).json()["user"]["email"] == "patient@reprocare.demo"


# ---- password reset ----

def test_password_reset_flow(client, account, outbox):
    r = client.post("/api/auth/forgot-password", json={"identifier": account["phone"]})
    assert r.status_code == 202
    assert len(outbox) == 1 and outbox[0]["to"] == account["email"]
    token = _token_from(outbox[0])

    with SessionLocal() as db:
        row = db.query(PasswordResetToken).filter_by(user_id=account["user"]["id"]).one()
        # only the hash is saved
        assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
        assert token not in row.token_hash
        assert timedelta(minutes=29) < row.expires_at - datetime.now(timezone.utc) <= timedelta(minutes=30)

    weak = client.post("/api/auth/reset-password", json={"token": token, "new_password": "short"})
    assert weak.status_code == 422
    assert client.post("/api/auth/reset-password", json={"token": token, "new_password": "Brand-new-2026"}).status_code == 204

    # signed out everywhere, old password gone, new one works
    assert client.get("/api/auth/me", headers={"Authorization": f"Bearer {account['token']}"}).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": account["email"], "password": account["password"]}).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": account["email"], "password": "Brand-new-2026"}).status_code == 200

    # link works only once
    again = client.post("/api/auth/reset-password", json={"token": token, "new_password": "Another-2026x"})
    assert again.status_code == 400 and "Request a new one" in again.json()["detail"]


def test_reset_reply_is_the_same_whether_or_not_the_account_exists(client, account, outbox):
    known = client.post("/api/auth/forgot-password", json={"identifier": account["email"]})
    unknown = client.post("/api/auth/forgot-password", json={"identifier": "nobody-here@example.com"})
    nonsense = client.post("/api/auth/forgot-password", json={"identifier": "not a phone"})
    assert known.status_code == unknown.status_code == nonsense.status_code == 202
    assert known.json() == unknown.json() == nonsense.json()
    assert len(outbox) == 1


def test_expired_and_superseded_reset_links_fail(client, account, outbox):
    client.post("/api/auth/forgot-password", json={"identifier": account["email"]})
    first = _token_from(outbox[0])
    client.post("/api/auth/forgot-password", json={"identifier": account["email"]})
    second = _token_from(outbox[1])
    # the first link was replaced by the second
    assert client.post("/api/auth/reset-password", json={"token": first, "new_password": "Brand-new-2026"}).status_code == 400

    with SessionLocal() as db:
        row = db.query(PasswordResetToken).filter_by(user_id=account["user"]["id"]).one()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
    assert client.post("/api/auth/reset-password", json={"token": second, "new_password": "Brand-new-2026"}).status_code == 400


def test_reset_requests_are_rate_limited(client, account, outbox):
    for _ in range(5):
        assert client.post("/api/auth/forgot-password", json={"identifier": account["email"]}).status_code == 202
    limited = client.post("/api/auth/forgot-password", json={"identifier": account["email"]})
    assert limited.status_code == 429
    # unknown emails are limited the same way
    for _ in range(5):
        client.post("/api/auth/forgot-password", json={"identifier": "ghost@example.com"})
    assert client.post("/api/auth/forgot-password", json={"identifier": "ghost@example.com"}).status_code == 429


def test_reset_link_is_logged_when_smtp_is_not_configured(client, account, capsys):
    client.post("/api/auth/forgot-password", json={"identifier": account["email"]})
    printed = capsys.readouterr().out
    assert "Reset your ReproCare password" in printed and "/reset-password?token=" in printed
    assert auth_routes.settings.smtp_host == ""


# ---- deleting an account ----

def _next_open_day(weekday=0):
    day = date.today() + timedelta(days=1)
    return day + timedelta(days=(weekday - day.weekday()) % 7)


def test_delete_account_removes_personal_data(client, account):
    headers = {"Authorization": f"Bearer {account['token']}"}
    appt = client.post("/api/appointments", headers=headers, json={
        "facility_slug": "mwangaza", "preferred_date": _next_open_day().isoformat(), "preferred_time": "morning", "contact_phone": account["phone"], "notes": "Private note",
    }).json()["reference"]
    slug = client.get("/api/programs").json()["items"][0]["slug"]
    client.post(f"/api/programs/{slug}/registrations", headers=headers, json={"full_name": account["user"]["full_name"], "phone": account["phone"], "consent": True})
    review = client.post("/api/facilities/jacaranda/reviews", headers=headers, json={"rating": 4, "title": "Kind staff", "body": "The nurses were kind and explained everything clearly.", "consent": True}).json()

    assert client.post("/api/auth/delete-account", headers=headers, json={"password": "wrong-password"}).status_code == 400
    assert client.post("/api/auth/delete-account", headers=headers, json={"password": account["password"]}).status_code == 204

    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": account["email"], "password": account["password"]}).status_code == 401
    assert client.post("/api/auth/login", json={"identifier": account["phone"], "password": account["password"]}).status_code == 401
    with SessionLocal() as db:
        user = db.get(User, account["user"]["id"])
        assert user.full_name == "Former member" and user.phone is None and account["email"] not in user.email
        assert user.deleted_at is not None and not user.is_active
        assert db.query(UserSession).filter_by(user_id=user.id).count() == 0
        a = db.query(AppointmentRequest).filter_by(reference=appt).one()
        assert a.status == "cancelled" and a.contact_phone == "" and a.notes == ""
        reg = db.query(ProgramRegistration).filter_by(user_id=user.id).one()
        assert reg.status == "cancelled" and reg.full_name == "Former member" and reg.phone == ""
        r = db.get(Review, review["id"])
        assert r.author_name == "Former member" and r.user_id is None
    # email and phone can be used again
    again = client.post("/api/auth/register", json={"full_name": "New Start", "email": account["email"], "password": "Passw0rd1", "phone": account["phone"]})
    assert again.status_code == 201


def test_admin_cannot_delete_own_account_and_deleted_accounts_stay_deleted(client, admin_headers, account):
    r = client.post("/api/auth/delete-account", headers=admin_headers, json={"password": "Admin#2026"})
    assert r.status_code == 403
    headers = {"Authorization": f"Bearer {account['token']}"}
    client.post("/api/auth/delete-account", headers=headers, json={"password": account["password"]})
    revived = client.patch(f"/api/admin/users/{account['user']['id']}", headers=admin_headers, json={"is_active": True})
    assert revived.status_code == 400