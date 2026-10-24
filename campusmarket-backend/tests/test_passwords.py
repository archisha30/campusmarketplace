"""Password login, lockout, the mandatory set-password step for old accounts, forgot/reset,
and sessions (HttpOnly cookie, renewal, logout-on-password-change)."""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

from app.api.routes import auth as auth_routes
from app.core.config import settings
from app.core.security import create_access_token
from app.models.user import User
from conftest import TEST_PASSWORD, _user

GOOD = "newpass123"
COOKIE = settings.SESSION_COOKIE_NAME


@pytest.fixture(autouse=True)
def mailbox(monkeypatch):
    """Capture sent codes instead of emailing them: {email: latest code}."""
    box = {}
    monkeypatch.setattr(auth_routes, "send_otp_email", lambda email, otp, *purpose: box.__setitem__(email, otp))
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    return box


@pytest.fixture
def legacy(db_session):
    """An account from before passwords existed: verified, profile done, no password."""
    db, _ = db_session
    return _user(db, "legacy@campus.edu", password_hash=None, account_type="seller")


def login(client, email, password):
    return client.post("/api/auth/login", json={"email": email, "password": password})


def session_of(res):
    """Use the session cookie a response set, as an explicit header (independent of the jar)."""
    return {"Authorization": f"Bearer {res.cookies[COOKIE]}"}


def existing_session(user, minutes_ago=0):
    """A session issued earlier (e.g. before this change, or one an attacker stole)."""
    now = datetime.now(timezone.utc)
    token = jwt.encode(
        {"sub": str(user.id), "iat": int((now - timedelta(minutes=minutes_ago)).timestamp()), "exp": now + timedelta(days=1)},
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return {"Authorization": f"Bearer {token}"}


def fetch(db_session, email):
    db, _ = db_session
    db.expire_all()
    return db.query(User).filter(User.email == email).first()


# ---------- signup ----------


def test_signup_with_password(client, db_session, mailbox):
    assert client.post("/api/auth/signup", json={"email": "riya@campus.edu", "account_type": "seller"}).status_code == 200
    res = client.post("/api/auth/signup/verify", json={
        "email": "riya@campus.edu", "otp": mailbox["riya@campus.edu"], "account_type": "seller",
        "password": GOOD, "confirm_password": GOOD,
    })
    assert res.status_code == 200, res.text
    user = res.json()["user"]
    assert user["has_password"] is True and user["verified"] is True and user["account_type"] == "seller"
    assert "password_hash" not in user and "token" not in res.json()
    stored = fetch(db_session, "riya@campus.edu")
    assert stored.password_hash.startswith("$argon2") and GOOD not in stored.password_hash
    assert login(client, "riya@campus.edu", GOOD).status_code == 200


@pytest.mark.parametrize("password,confirm,msg", [
    ("short1", "short1", "at least 8"),
    ("abcdefgh", "abcdefgh", "letter and one number"),
    ("12345678", "12345678", "letter and one number"),
    ("abc12345", "abc12346", "don't match"),
])
def test_signup_password_rules(client, db_session, mailbox, password, confirm, msg):
    client.post("/api/auth/signup", json={"email": "riya@campus.edu"})
    res = client.post("/api/auth/signup/verify", json={
        "email": "riya@campus.edu", "otp": mailbox["riya@campus.edu"], "password": password, "confirm_password": confirm,
    })
    assert res.status_code == 422 and msg in str(res.json()["detail"])
    assert fetch(db_session, "riya@campus.edu") is None


def test_signup_wrong_code_creates_nothing(client, db_session, mailbox):
    client.post("/api/auth/signup", json={"email": "riya@campus.edu"})
    wrong = "000000" if mailbox["riya@campus.edu"] != "000000" else "111111"
    res = client.post("/api/auth/signup/verify", json={
        "email": "riya@campus.edu", "otp": wrong, "password": GOOD, "confirm_password": GOOD,
    })
    assert res.status_code == 400 and fetch(db_session, "riya@campus.edu") is None


# ---------- password login ----------


def test_password_login_sets_httponly_cookie(client, users):
    res = login(client, "buyer@campus.edu", TEST_PASSWORD)
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "buyer@campus.edu"
    assert "token" not in res.json()  # never handed to page scripts
    cookie = res.headers["set-cookie"].lower()
    assert f"{COOKIE}=" in cookie and "httponly" in cookie and "samesite=lax" in cookie and "path=/api" in cookie
    # The browser just sends the cookie back.
    assert client.get("/api/users/me").json()["email"] == "buyer@campus.edu"


def test_login_failure_is_identical_for_every_case(client, users, legacy):
    wrong_pw = login(client, "buyer@campus.edu", "nope12345")
    no_user = login(client, "ghost@campus.edu", "nope12345")
    no_password_yet = login(client, "legacy@campus.edu", "nope12345")
    for res in (wrong_pw, no_user, no_password_yet):
        assert res.status_code == 401 and res.json()["detail"] == "Invalid email or password"


def test_lockout_is_identical_for_real_and_unknown_emails(client, db_session, users):
    real = [login(client, "buyer@campus.edu", "wrong12345").status_code for _ in range(settings.LOGIN_MAX_FAILURES + 1)]
    fake = [login(client, "ghost@campus.edu", "wrong12345").status_code for _ in range(settings.LOGIN_MAX_FAILURES + 1)]
    assert real == fake == [401] * (settings.LOGIN_MAX_FAILURES - 1) + [429, 429]
    # Even the right password is refused while locked.
    assert login(client, "buyer@campus.edu", TEST_PASSWORD).status_code == 429
    assert fetch(db_session, "buyer@campus.edu").locked_until is not None


def test_ip_rate_limit(client, users, monkeypatch):
    monkeypatch.setattr(auth_routes._login_ip_limiter, "limit", 3)
    for email in ["a@campus.edu", "b@campus.edu", "c@campus.edu"]:
        assert login(client, email, "whatever123").status_code == 401
    assert login(client, "buyer@campus.edu", TEST_PASSWORD).status_code == 429


def test_logout_clears_the_cookie(client, users):
    login(client, "buyer@campus.edu", TEST_PASSWORD)
    assert client.get("/api/users/me").status_code == 200
    res = client.post("/api/auth/logout")
    assert res.status_code == 204 and COOKIE in res.headers["set-cookie"]
    assert client.get("/api/users/me").status_code == 401


# ---------- accounts without a password ----------


def test_old_account_sets_first_password_via_forgot_password(client, legacy, mailbox):
    """No code-login fallback (it revealed which accounts exist): old accounts use Forgot password."""
    client.post("/api/auth/password/forgot", json={"email": "legacy@campus.edu"})
    res = client.post("/api/auth/password/reset", json={
        "email": "legacy@campus.edu", "otp": mailbox["legacy@campus.edu"], "password": GOOD, "confirm_password": GOOD,
    })
    assert res.status_code == 200 and res.json()["user"]["has_password"] is True
    assert login(client, "legacy@campus.edu", GOOD).status_code == 200


def test_protected_routes_blocked_until_password_set(client, legacy):
    h = existing_session(legacy)  # e.g. still logged in from before passwords existed

    # /users/me works (so the app can ask for a password)...
    assert client.get("/api/users/me", headers=h).json()["has_password"] is False
    # ...but everything else is refused.
    for method, path, body in [
        ("get", "/api/listings", None),
        ("get", "/api/resources", None),
        ("get", "/api/notifications", None),
        ("patch", "/api/users/me", {"name": "x"}),
        ("post", "/api/listings", {"title": "x", "category": "Sports", "condition": "Good", "pickup_spot": "x"}),
        ("post", "/api/contact", {"target_type": "listing", "target_id": 1, "channel": "email"}),
    ]:
        res = getattr(client, method)(path, headers=h, **({"json": body} if body else {}))
        assert res.status_code == 403, path
        assert res.json()["detail"]["code"] == "password_required", path

    res = client.post("/api/auth/set-password", json={"password": GOOD, "confirm_password": GOOD}, headers=h)
    assert res.status_code == 200 and res.json()["user"]["has_password"] is True
    assert client.get("/api/listings", headers=session_of(res)).status_code == 200


def test_set_password_refused_when_one_exists(client, auth):
    res = client.post("/api/auth/set-password", json={"password": GOOD, "confirm_password": GOOD}, headers=auth("buyer"))
    assert res.status_code == 409


def test_set_password_validates(client, legacy):
    res = client.post("/api/auth/set-password", json={"password": "abc", "confirm_password": "abc"}, headers=existing_session(legacy))
    assert res.status_code == 422


# ---------- forgot / reset ----------


def test_password_reset(client, db_session, users, mailbox):
    for _ in range(settings.LOGIN_MAX_FAILURES):  # lock it first: reset should also unlock
        login(client, "buyer@campus.edu", "wrong12345")

    assert client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"}).status_code == 200
    res = client.post("/api/auth/password/reset", json={
        "email": "buyer@campus.edu", "otp": mailbox["buyer@campus.edu"], "password": GOOD, "confirm_password": GOOD,
    })
    assert res.status_code == 200 and COOKIE in res.cookies
    assert login(client, "buyer@campus.edu", TEST_PASSWORD).status_code == 401  # old password gone
    assert login(client, "buyer@campus.edu", GOOD).status_code == 200
    assert fetch(db_session, "buyer@campus.edu").locked_until is None


def test_forgot_password_does_not_reveal_accounts(client, mailbox):
    known = client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    unknown = client.post("/api/auth/password/forgot", json={"email": "ghost@campus.edu"})
    assert known.status_code == unknown.status_code == 200 and known.json() == unknown.json()
    assert "ghost@campus.edu" not in mailbox


def test_reset_code_is_single_use_and_purpose_bound(client, users, mailbox):
    client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    body = {"email": "buyer@campus.edu", "otp": mailbox["buyer@campus.edu"], "password": GOOD, "confirm_password": GOOD}
    assert client.post("/api/auth/password/reset", json=body).status_code == 200
    assert client.post("/api/auth/password/reset", json=body).status_code == 400  # used up
    client.post("/api/auth/signup", json={"email": "riya@campus.edu"})  # a signup code can't reset a password
    res = client.post("/api/auth/password/reset", json={**body, "email": "riya@campus.edu", "otp": mailbox["riya@campus.edu"]})
    assert res.status_code == 400


def test_wrong_codes_burn_the_code(client, users, mailbox):
    client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    real = mailbox["buyer@campus.edu"]
    wrong = "000000" if real != "000000" else "111111"
    body = {"email": "buyer@campus.edu", "password": GOOD, "confirm_password": GOOD}
    for _ in range(settings.OTP_MAX_ATTEMPTS):
        assert client.post("/api/auth/password/reset", json={**body, "otp": wrong}).status_code == 400
    res = client.post("/api/auth/password/reset", json={**body, "otp": real})
    assert res.status_code == 400 and "Too many" in res.json()["detail"]


# ---------- sessions ----------


def test_password_reset_logs_out_older_sessions(client, users, mailbox):
    stolen = existing_session(users["buyer"], minutes_ago=1)
    assert client.get("/api/users/me", headers=stolen).status_code == 200
    client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    res = client.post("/api/auth/password/reset", json={
        "email": "buyer@campus.edu", "otp": mailbox["buyer@campus.edu"], "password": GOOD, "confirm_password": GOOD,
    })
    gone = client.get("/api/users/me", headers=stolen)
    assert gone.status_code == 401 and "Log in again" in gone.json()["detail"]
    assert client.get("/api/users/me", headers=session_of(res)).status_code == 200
    assert client.post("/api/auth/refresh", headers=stolen).status_code == 401  # and it can't be renewed


def test_sessions_last_30_days_and_renew(client, users):
    res = login(client, "buyer@campus.edu", TEST_PASSWORD)
    claims = jwt.decode(res.cookies[COOKIE], settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    assert claims["exp"] - claims["iat"] == 30 * 24 * 3600

    renewed = client.post("/api/auth/refresh")  # browser sends the cookie
    assert renewed.status_code == 200 and COOKIE in renewed.cookies
    client.cookies.clear()
    assert client.post("/api/auth/refresh").status_code == 401  # no session, nothing to renew


def test_old_browser_session_moves_into_cookie(client, users):
    """Older versions of the app kept the session in the browser; refresh with it as a Bearer
    header swaps it for the HttpOnly cookie, so nobody is logged out by the change."""
    legacy_token = create_access_token(users["buyer"].id)
    res = client.post("/api/auth/refresh", headers={"Authorization": f"Bearer {legacy_token}"})
    assert res.status_code == 200 and COOKIE in res.cookies
    assert client.get("/api/users/me").json()["email"] == "buyer@campus.edu"


# ---------- CSRF ----------


def test_cookie_writes_need_the_app_header(client, users):
    login(client, "buyer@campus.edu", TEST_PASSWORD)
    del client.headers["X-Requested-With"]
    forged = client.patch("/api/users/me", json={"name": "Hacked"})
    assert forged.status_code == 403 and "security header" in forged.json()["detail"]
    assert client.get("/api/users/me").status_code == 200  # reads are fine
    client.headers["X-Requested-With"] = "CampusMarket"
    assert client.patch("/api/users/me", json={"name": "Buyer"}).status_code == 200
