"""Signup codes and domain checks. Signup gives the same answer whether or not the email
already has an account."""

import pytest

from app.api.routes import auth as auth_routes
from app.models.user import User


@pytest.fixture(autouse=True)
def domains(monkeypatch):
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])


def _user(db_session, email):
    db, _ = db_session
    db.expire_all()
    return db.query(User).filter(User.email == email).first()


def test_signup_code_does_not_create_the_account(client, db_session, no_real_email):
    res = client.post("/api/auth/signup", json={"email": "new@campus.edu", "account_type": "seller"})
    assert res.status_code == 200
    [(to, subject, _)] = no_real_email
    assert to == "new@campus.edu" and subject.endswith("is your CampusMarket code")
    assert _user(db_session, "new@campus.edu") is None  # created only after the code is verified


def test_signup_answers_the_same_for_existing_accounts(client, users, no_real_email):
    new = client.post("/api/auth/signup", json={"email": "fresh@campus.edu"})
    existing = client.post("/api/auth/signup", json={"email": "buyer@campus.edu"})
    assert new.status_code == existing.status_code == 200
    assert new.json() == existing.json()
    # The existing account gets a heads-up email, never a code.
    to, subject, body = no_real_email[-1]
    assert to == "buyer@campus.edu" and "already have" in subject
    assert not any(ch.isdigit() for ch in body.split("CampusMarket")[0])


def test_signup_verify_for_existing_account_looks_like_a_bad_code(client, users):
    res = client.post("/api/auth/signup/verify", json={
        "email": "buyer@campus.edu", "otp": "123456", "password": "abc12345", "confirm_password": "abc12345",
    })
    assert res.status_code == 400 and res.json()["detail"] == "Code expired, request a new one"


def test_code_login_endpoints_are_gone(client):
    assert client.post("/api/auth/login-code", json={"email": "buyer@campus.edu"}).status_code in (404, 405)
    assert client.post("/api/auth/login/otp", json={"email": "buyer@campus.edu", "otp": "1"}).status_code in (404, 405)


def test_domain_check(client):
    assert client.post("/api/auth/signup", json={"email": "x@gmail.com"}).status_code == 400
    assert client.post("/api/auth/password/forgot", json={"email": "x@gmail.com"}).status_code == 400


def test_owner_can_use_a_personal_email(client, monkeypatch, no_real_email):
    monkeypatch.setattr(auth_routes.settings, "OWNER_EMAILS", ["Boss@Gmail.com"])
    assert client.post("/api/auth/signup", json={"email": "boss@gmail.com", "account_type": "seller"}).status_code == 200
    assert no_real_email[-1][0] == "boss@gmail.com"
    # Any other personal address is still refused.
    assert client.post("/api/auth/signup", json={"email": "someone@gmail.com"}).status_code == 400
