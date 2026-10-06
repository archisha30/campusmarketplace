"""Signup lets new students pick buyer/seller; the login code endpoint never creates accounts."""

import pytest

from app.api.routes import auth as auth_routes
from app.models.user import User


@pytest.fixture(autouse=True)
def no_email(monkeypatch):
    sent = []
    monkeypatch.setattr(auth_routes, "send_otp_email", lambda email, otp: sent.append(email))
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    return sent


def _user(db_session, email):
    db, _ = db_session
    db.expire_all()
    return db.query(User).filter(User.email == email).first()


def test_signup_creates_account_with_chosen_type(client, db_session, no_email):
    res = client.post("/api/auth/signup", json={"email": "new@campus.edu", "account_type": "seller"})
    assert res.status_code == 200
    assert _user(db_session, "new@campus.edu").account_type == "seller"
    assert no_email == ["new@campus.edu"]


def test_login_code_for_unknown_email_creates_nothing(client, db_session, no_email):
    res = client.post("/api/auth/login-code", json={"email": "stranger@campus.edu"})
    assert res.status_code == 404
    assert "Sign up first" in res.json()["detail"]
    assert _user(db_session, "stranger@campus.edu") is None
    assert no_email == []


def test_login_code_keeps_account_type(client, db_session, no_email):
    # Chose seller at signup but never verified, then came back through the Log In page.
    client.post("/api/auth/signup", json={"email": "half@campus.edu", "account_type": "seller"})
    res = client.post("/api/auth/login-code", json={"email": "half@campus.edu"})
    assert res.status_code == 200
    assert _user(db_session, "half@campus.edu").account_type == "seller"
    assert no_email == ["half@campus.edu", "half@campus.edu"]


def test_login_code_for_existing_user(client, users, no_email):
    assert client.post("/api/auth/login-code", json={"email": "owner@campus.edu"}).status_code == 200
    assert no_email == ["owner@campus.edu"]


def test_login_code_checks_domain(client):
    assert client.post("/api/auth/login-code", json={"email": "x@gmail.com"}).status_code == 400
