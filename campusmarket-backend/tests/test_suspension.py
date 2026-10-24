"""Admins suspend rule-breakers: sessions stop, content disappears, the email is banned for good."""

import pytest

from app.core.config import settings
from conftest import TEST_PASSWORD, post_listing
from test_google import CLIENT_ID, GOOGLE_KEY, google, token


@pytest.fixture(autouse=True)
def campus_domain(monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    monkeypatch.setattr(settings, "OWNER_EMAILS", ["owner@campus.edu"])


def suspend(client, auth, who, target, reason="Selling fake notes"):
    return client.post(f"/api/admin/users/{target.id}/suspend", json={"reason": reason}, headers=auth(who))


def login(client, email):
    return client.post("/api/auth/login", json={"email": email, "password": TEST_PASSWORD})


def test_suspended_user_is_locked_out_everywhere(client, auth, users):
    res = suspend(client, auth, "admin", users["buyer"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["suspended"] is True and body["suspension_reason"] == "Selling fake notes"

    # The session they already have stops working, including /users/me.
    for path in ("/api/users/me", "/api/listings", "/api/wishlist"):
        res = client.get(path, headers=auth("buyer"))
        assert res.status_code == 403
        assert res.json()["detail"]["code"] == "account_suspended"

    # Right password: told they're suspended. Wrong password: nothing given away.
    res = login(client, "buyer@campus.edu")
    assert res.status_code == 403 and "suspended" in res.json()["detail"]
    assert login(client, "buyer@campus.edu").cookies.get(settings.SESSION_COOKIE_NAME) is None
    assert client.post("/api/auth/login", json={"email": "buyer@campus.edu", "password": "wrong-pass1"}).status_code == 401


def test_email_can_never_sign_up_again(client, auth, users, no_real_email):
    suspend(client, auth, "admin", users["buyer"])
    for email in ("buyer@campus.edu", "  BUYER@campus.edu "):
        res = client.post("/api/auth/signup", json={"email": email.strip(), "account_type": "buyer"})
        assert res.status_code == 403 and "can't be used" in res.json()["detail"]
    res = client.post("/api/auth/signup/verify", json={
        "email": "buyer@campus.edu", "otp": "123456", "account_type": "buyer",
        "password": "NewPass123", "confirm_password": "NewPass123",
    })
    assert res.status_code == 403
    # No reset code goes out either.
    client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    assert no_real_email == []


def test_banned_email_blocked_from_google(client, auth, users, monkeypatch):
    from app.core import google as google_module

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)

    class FakeKeys:  # stands in for Google's signing keys, as in test_google.py
        def get_signing_key_from_jwt(self, _):
            return type("K", (), {"key": GOOGLE_KEY.public_key()})()

    monkeypatch.setattr(google_module, "_keys", FakeKeys())
    suspend(client, auth, "admin", users["buyer"])
    res = google(client, token(email="buyer@campus.edu", sub="g-buyer"))
    assert res.status_code == 403


def test_their_listings_resources_and_requests_disappear(client, auth, users, create, db_session):
    db, _ = db_session
    users["buyer"].account_type = "seller"
    db.commit()
    lid = post_listing(client, auth("buyer"), {
        "title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100,
    }).json()["id"]
    rid = create(as_user="buyer").json()["id"]
    client.post("/api/requests", json={"product": "Drafter", "description": ""}, headers=auth("buyer"))

    suspend(client, auth, "admin", users["buyer"])

    assert client.get(f"/api/listings/{lid}", headers=auth("other")).status_code == 404
    assert lid not in [l["id"] for l in client.get("/api/listings", headers=auth("other")).json()["items"]]
    assert client.get(f"/api/resources/{rid}", headers=auth("other")).status_code == 404
    assert client.post("/api/contact", json={"target_type": "listing", "target_id": lid, "channel": "whatsapp"},
                       headers=auth("other")).status_code == 404
    assert [r["product"] for r in client.get("/api/requests", headers=auth("owner")).json()] == []

    # Reinstating (a mistake) brings everything back and unbans the email.
    res = client.post(f"/api/admin/users/{users['buyer'].id}/reinstate", headers=auth("admin"))
    assert res.status_code == 200 and res.json()["suspended"] is False
    assert client.get(f"/api/listings/{lid}", headers=auth("other")).status_code == 200
    assert login(client, "buyer@campus.edu").status_code == 200


def test_who_can_suspend_whom(client, auth, users, db_session):
    db, _ = db_session
    assert suspend(client, auth, "buyer", users["other"]).status_code == 403  # not an admin
    assert suspend(client, auth, "admin", users["admin"]).status_code == 400  # yourself
    assert suspend(client, auth, "admin", users["owner"]).status_code == 400  # owner (OWNER_EMAILS)
    users["other"].role = "admin"
    db.commit()
    assert suspend(client, auth, "admin", users["other"]).status_code == 403  # only the owner suspends admins
    res = suspend(client, auth, "owner", users["other"])
    assert res.status_code == 200 and res.json()["is_admin"] is False  # loses admin too
    assert suspend(client, auth, "admin", users["buyer"], reason=" ").status_code == 422  # needs a reason


def test_admin_list_shows_suspensions(client, auth, users):
    suspend(client, auth, "admin", users["buyer"])
    data = client.get("/api/admin/users", headers=auth("admin")).json()
    assert data["suspended"] == 1
    row = next(u for u in data["items"] if u["email"] == "buyer@campus.edu")
    assert row["suspended"] and row["suspension_reason"] == "Selling fake notes"
