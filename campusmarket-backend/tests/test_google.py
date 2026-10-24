"""Continue with Google: token verification, college-domain rule, signup vs login, no password needed."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from app.api.routes import auth as auth_routes
from app.core import google as google_module
from app.core.config import settings

CLIENT_ID = "test-client.apps.googleusercontent.com"
GOOGLE_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(autouse=True)
def google_setup(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", CLIENT_ID)
    monkeypatch.setattr(settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])

    class FakeKeys:  # stands in for Google's published signing keys
        def get_signing_key_from_jwt(self, token):
            return type("K", (), {"key": GOOGLE_KEY.public_key()})()

    monkeypatch.setattr(google_module, "_keys", FakeKeys())


def token(key=GOOGLE_KEY, **overrides):
    now = int(time.time())
    claims = {
        "iss": "https://accounts.google.com", "aud": CLIENT_ID, "sub": "google-123",
        "email": "riya@campus.edu", "email_verified": True, "hd": "campus.edu", "name": "Riya Sharma",
        "iat": now, "exp": now + 600,
    }
    claims.update(overrides)
    return jwt.encode({k: v for k, v in claims.items() if v is not None}, key, algorithm="RS256")


def google(client, credential, account_type="buyer"):
    return client.post("/api/auth/google", json={"credential": credential, "account_type": account_type})


# ---------- token verification ----------


def test_valid_token_is_accepted():
    assert google_module.verify_google_token(token())["email"] == "riya@campus.edu"


@pytest.mark.parametrize("bad", [
    {"key": OTHER_KEY},                              # not signed by Google
    {"aud": "someone-elses-app"},                    # issued for another app
    {"iss": "https://evil.example"},                 # not from Google
    {"exp": int(time.time()) - 3600},                # expired
    {"email_verified": False},                       # Google hasn't verified the email
])
def test_bad_tokens_are_refused(bad):
    with pytest.raises(google_module.GoogleTokenError):
        google_module.verify_google_token(token(**bad))


def test_google_off_without_client_id(client, monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", None)
    res = google(client, token())
    assert res.status_code == 401 and "isn't set up" in res.json()["detail"]


# ---------- signup / login ----------


def test_new_student_signs_up_in_one_tap(client):
    res = google(client, token(), account_type="seller")
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["created"] is True
    user = body["user"]
    assert user["email"] == "riya@campus.edu" and user["verified"] is True and user["account_type"] == "seller"
    assert user["name"] == "Riya Sharma"
    assert user["uses_google"] is True and user["has_password"] is False and user["needs_password"] is False
    assert settings.SESSION_COOKIE_NAME in res.cookies
    # No password needed: the account isn't blocked like old email-only accounts.
    assert client.get("/api/listings").status_code == 200


def test_second_tap_logs_into_the_same_account(client):
    first = google(client, token(), account_type="seller").json()
    again = google(client, token(), account_type="buyer").json()
    assert again["created"] is False and again["user"]["id"] == first["user"]["id"]
    assert again["user"]["account_type"] == "seller"  # the choice only applies to new accounts


def test_existing_email_account_gets_linked(client, users):
    res = google(client, token(email="buyer@campus.edu", sub="google-buyer"))
    assert res.status_code == 200
    assert res.json()["created"] is False and res.json()["user"]["id"] == str(users["buyer"].id)
    assert res.json()["user"]["uses_google"] is True and res.json()["user"]["has_password"] is True


def test_email_linked_to_another_google_account(client):
    google(client, token(sub="google-a"))
    res = google(client, token(sub="google-b"))
    assert res.status_code == 409


@pytest.mark.parametrize("claims", [
    {"email": "riya@gmail.com", "hd": None},            # personal Gmail
    {"email": "riya@campus.edu", "hd": None},           # college address, but not the college's Google Workspace
    {"email": "riya@other.edu", "hd": "other.edu"},     # another college
])
def test_only_college_google_accounts(client, claims):
    res = google(client, token(**claims))
    assert res.status_code == 403 and "college Google account" in res.json()["detail"]


def test_owner_can_use_personal_google(client, monkeypatch):
    monkeypatch.setattr(settings, "OWNER_EMAILS", ["boss@gmail.com"])
    assert google(client, token(email="boss@gmail.com", hd=None, sub="g-boss")).status_code == 200


def test_bad_token_is_401(client):
    assert google(client, token(key=OTHER_KEY)).status_code == 401


def test_google_user_can_add_a_password_later(client):
    google(client, token())
    res = client.post("/api/auth/set-password", json={"password": "riya12345", "confirm_password": "riya12345"})
    assert res.status_code == 200 and res.json()["user"]["has_password"] is True
    client.cookies.clear()
    assert client.post("/api/auth/login", json={"email": "riya@campus.edu", "password": "riya12345"}).status_code == 200


def test_google_only_account_cannot_password_login(client):
    google(client, token())
    client.cookies.clear()
    res = client.post("/api/auth/login", json={"email": "riya@campus.edu", "password": "anything123"})
    assert res.status_code == 401 and res.json()["detail"] == "Invalid email or password"


def test_domain_message_lists_every_college(monkeypatch):
    from app.api.routes import auth as auth_routes

    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["a.edu.in", "b.com"])
    assert auth_routes._allowed_domains_text() == "@a.edu.in or @b.com"
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["a.edu.in"])
    assert auth_routes._allowed_domains_text() == "@a.edu.in"


def test_new_google_account_must_choose_buyer_or_seller(client):
    res = client.post("/api/auth/google", json={"credential": token()})  # e.g. from the Login page
    assert res.status_code == 400 and "Buyer or Seller" in res.json()["detail"]
    # An existing account logs in without choosing.
    google(client, token(), account_type="seller")
    res = client.post("/api/auth/google", json={"credential": token()})
    assert res.status_code == 200 and res.json()["user"]["account_type"] == "seller"
