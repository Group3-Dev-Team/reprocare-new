"""Role-based access and ownership: nobody reaches another person's records by changing a URL or parameter."""

from datetime import date, timedelta

from tests.conftest import auth_headers


def test_protected_routes_require_sign_in(client):
    for method, path in [("get", "/api/me/appointments"), ("get", "/api/me/saved"), ("get", "/api/facility/overview"), ("get", "/api/admin/overview"), ("get", "/api/auth/me")]:
        assert getattr(client, method)(path).status_code == 401, path


def test_roles_are_enforced(client, new_patient, staff_headers):
    patient, _ = new_patient
    assert client.get("/api/admin/overview", headers=patient).status_code == 403
    assert client.get("/api/facility/overview", headers=patient).status_code == 403
    assert client.get("/api/admin/overview", headers=staff_headers).status_code == 403
    assert client.get("/api/me/appointments", headers=staff_headers).status_code == 403


def _request(client, headers, facility="mwangaza", days=5):
    body = {"facility_slug": facility, "preferred_date": (date.today() + timedelta(days=days)).isoformat(), "preferred_time": "morning", "contact_phone": "+254711222333"}
    r = client.post("/api/appointments", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()["reference"]


def test_patient_cannot_touch_another_patients_appointment(client, new_patient):
    owner, _ = new_patient
    ref = _request(client, owner, days=9)
    other = client.post("/api/auth/register", json={"full_name": "Other Person", "email": "other.person@example.com", "password": "Passw0rd1"}).json()
    other_headers = {"Authorization": f"Bearer {other['token']}"}
    assert client.post(f"/api/me/appointments/{ref}/cancel", headers=other_headers).status_code == 404
    refs = [a["reference"] for a in client.get("/api/me/appointments", headers=other_headers).json()["items"]]
    assert ref not in refs


def test_facility_staff_see_only_their_facility(client, new_patient):
    patient, _ = new_patient
    ref = _request(client, patient, facility="kipepeo", days=11)
    mwangaza_staff = auth_headers(client, "staff@reprocare.demo", "Staff#2026")
    kipepeo_staff = auth_headers(client, "staff.kipepeo@reprocare.demo", "Staff#2026")
    assert ref not in [a["reference"] for a in client.get("/api/facility/appointments", headers=mwangaza_staff).json()["items"]]
    assert client.patch(f"/api/facility/appointments/{ref}", headers=mwangaza_staff, json={"status": "confirmed"}).status_code == 404
    assert client.patch(f"/api/facility/appointments/{ref}", headers=kipepeo_staff, json={"status": "confirmed"}).status_code == 200


def test_import_requires_key_or_admin(client, new_patient):
    payload = {"source": {"code": "reprocare_bot"}, "facilities": [{"external_id": "x"}]}
    assert client.post("/api/import/facilities", json=payload).status_code == 401
    assert client.post("/api/import/facilities", json=payload, headers={"X-Import-Key": "wrong"}).status_code == 401
    patient, _ = new_patient
    assert client.post("/api/import/facilities", json=payload, headers=patient).status_code == 401
