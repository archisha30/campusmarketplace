"""Every student gives a WhatsApp number at onboarding; it's what "Contact Seller" opens."""

import pytest

from conftest import _user


@pytest.fixture
def fresh(db_session):
    db, _ = db_session
    return _user(db, "fresh@campus.edu", profile_completed=False, phone=None, account_type="seller")


@pytest.fixture
def fresh_auth(fresh):
    from app.core.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(fresh.id)}"}


PROFILE = {"name": "Riya", "college": "Polaris", "course": "AI/ML", "year": "1st Year"}


@pytest.mark.parametrize("raw", ["9876543210", "+91 98765 43210", "098765-43210"])
def test_onboarding_saves_phone(client, fresh_auth, raw):
    res = client.post("/api/auth/profile", json={**PROFILE, "phone": raw}, headers=fresh_auth)
    assert res.status_code == 200, res.text
    assert res.json()["phone"] == "919876543210" and res.json()["profile_completed"] is True


@pytest.mark.parametrize("raw", [None, "", "12345", "5876543210"])
def test_onboarding_requires_a_valid_phone(client, fresh_auth, raw):
    body = {**PROFILE, **({} if raw is None else {"phone": raw})}
    assert client.post("/api/auth/profile", json=body, headers=fresh_auth).status_code == 422


def test_phone_can_change_but_not_be_removed(client, auth):
    ok = client.patch("/api/users/me", json={"phone": "9123456789"}, headers=auth("owner"))
    assert ok.status_code == 200 and ok.json()["phone"] == "919123456789"
    gone = client.patch("/api/users/me", json={"phone": ""}, headers=auth("owner"))
    assert gone.status_code == 422 and "required" in str(gone.json()["detail"])
    # Other fields still update without touching the phone.
    assert client.patch("/api/users/me", json={"name": "Owner"}, headers=auth("owner")).status_code == 200


def test_posting_needs_a_phone(client, db_session, users, auth, create):
    db, _ = db_session
    users["owner"].phone = None
    db.commit()
    listing = {"title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100}
    res = client.post("/api/listings", json=listing, headers=auth("owner"))
    assert res.status_code == 403 and "WhatsApp number" in res.json()["detail"]
    res = create()
    assert res.status_code == 403 and "WhatsApp number" in res.json()["detail"]
