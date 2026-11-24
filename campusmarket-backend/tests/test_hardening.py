"""Security hardening: daily cap on wrong codes, posting/upload limits, API security headers,
production settings checks, and who may reinstate a suspended account."""

from datetime import timedelta

import pytest
from pydantic import ValidationError

from app.api.routes import auth as auth_routes
from app.core import quotas
from app.core.config import Settings, settings
from app.core.ratelimit import SlidingWindowLimiter
from app.core.timeutil import utcnow
from app.models.listing import Listing
from app.models.otp import OTPFailure
from conftest import _user, png_bytes, post_listing

GOOD = "newpass123"
LISTING = {"title": "Casio fx-991EX", "category": "Electronics", "price": 500, "condition": "Good", "pickup_spot": "Library"}


@pytest.fixture(autouse=True)
def mailbox(monkeypatch):
    box = {}
    monkeypatch.setattr(auth_routes, "send_otp_email", lambda email, otp, *purpose: box.__setitem__(email, otp))
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    return box


def new_reset_code(client, mailbox, email="buyer@campus.edu"):
    auth_routes._code_email_limiter.reset()  # skip the one-code-a-minute wait
    mailbox.pop(email, None)
    client.post("/api/auth/password/forgot", json={"email": email})
    return mailbox.get(email)


def reset(client, otp, email="buyer@campus.edu"):
    return client.post("/api/auth/password/reset", json={"email": email, "otp": otp, "password": GOOD, "confirm_password": GOOD})


def wrong_for(code):
    return "000000" if code != "000000" else "111111"


# ---------- A: daily cap on wrong codes, across fresh codes ----------


def test_fresh_codes_dont_give_fresh_guesses_past_the_daily_cap(client, users, mailbox, monkeypatch):
    monkeypatch.setattr(settings, "OTP_DAILY_FAILURE_LIMIT", 6)
    # 5 wrong on the first code, 1 wrong on a fresh one: the email's 6 wrong guesses for today are used up.
    code = new_reset_code(client, mailbox)
    for _ in range(5):
        assert reset(client, wrong_for(code)).status_code == 400
    code = new_reset_code(client, mailbox)
    assert reset(client, wrong_for(code)).status_code == 400

    # Even the right code from a brand-new email is refused now...
    code = new_reset_code(client, mailbox)
    assert code is None  # ...and no new code is sent at all while locked (no inbox flooding)
    res = reset(client, "123456")
    assert res.status_code == 429 and "tomorrow" in res.json()["detail"]


def test_right_code_still_works_under_the_cap(client, users, mailbox):
    code = new_reset_code(client, mailbox)
    assert reset(client, wrong_for(code)).status_code == 400
    assert reset(client, code).status_code == 200


def test_cap_clears_after_a_day(client, users, mailbox, db_session, monkeypatch):
    monkeypatch.setattr(settings, "OTP_DAILY_FAILURE_LIMIT", 2)
    db, _ = db_session
    db.add_all([OTPFailure(email="buyer@campus.edu", created_at=utcnow() - timedelta(hours=25)) for _ in range(5)])
    db.commit()
    code = new_reset_code(client, mailbox)
    assert code is not None
    assert reset(client, code).status_code == 200


def test_cap_is_per_email_and_case_insensitive(client, users, mailbox, db_session, monkeypatch):
    monkeypatch.setattr(settings, "OTP_DAILY_FAILURE_LIMIT", 2)
    db, _ = db_session
    db.add_all([OTPFailure(email="buyer@campus.edu") for _ in range(2)])
    db.commit()
    assert reset(client, "123456", email="BUYER@campus.edu").status_code == 429
    code = new_reset_code(client, mailbox, email="other@campus.edu")  # someone else isn't affected
    assert reset(client, code, email="other@campus.edu").status_code == 200


def test_signup_codes_share_the_cap(client, mailbox, db_session, monkeypatch):
    monkeypatch.setattr(settings, "OTP_DAILY_FAILURE_LIMIT", 1)
    db, _ = db_session
    db.add(OTPFailure(email="fresh@campus.edu"))
    db.commit()
    assert client.post("/api/auth/signup", json={"email": "fresh@campus.edu", "account_type": "buyer"}).status_code == 200
    assert "fresh@campus.edu" not in mailbox  # same answer, but no code goes out
    res = client.post("/api/auth/signup/verify", json={
        "email": "fresh@campus.edu", "otp": "123456", "account_type": "buyer", "password": GOOD, "confirm_password": GOOD,
    })
    assert res.status_code == 429


# ---------- B: posting and upload limits ----------


def test_listing_post_limit_per_hour(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "LISTINGS_PER_HOUR", 2)
    for _ in range(2):
        assert post_listing(client, auth("owner"), LISTING).status_code == 200
    res = post_listing(client, auth("owner"), LISTING)
    assert res.status_code == 429 and "hour" in res.json()["detail"]
    # Per account: another seller can still post.
    monkeypatch.setattr(settings, "LISTINGS_PER_HOUR", 10)
    assert post_listing(client, auth("admin"), LISTING).status_code == 200


def test_deleting_doesnt_reset_the_post_limit(client, auth, monkeypatch):
    monkeypatch.setattr(settings, "LISTINGS_PER_DAY", 1)
    first = post_listing(client, auth("owner"), LISTING).json()
    assert client.delete(f"/api/listings/{first['id']}", headers=auth("owner")).status_code == 204
    res = post_listing(client, auth("owner"), LISTING)
    assert res.status_code == 429 and "today" in res.json()["detail"]


def test_older_listings_dont_count(client, auth, db_session, monkeypatch):
    monkeypatch.setattr(settings, "LISTINGS_PER_DAY", 1)
    post_listing(client, auth("owner"), LISTING)
    db, _ = db_session
    db.query(Listing).update({Listing.created_at: utcnow() - timedelta(days=2)})
    db.commit()
    assert post_listing(client, auth("owner"), LISTING).status_code == 200


def test_resource_post_limit(client, create, monkeypatch):
    monkeypatch.setattr(settings, "RESOURCES_PER_HOUR", 1)
    assert create().status_code == 201
    assert create().status_code == 429


def test_photo_upload_limit_counts_each_file(client, auth, monkeypatch):
    monkeypatch.setattr(quotas.photo_limiter, "limit", 4)
    lid = post_listing(client, auth("owner"), LISTING, photos=3).json()["id"]  # 3 of 4
    two = [("files", (f"x{i}.png", png_bytes(), "image/png")) for i in range(2)]
    res = client.put(f"/api/listings/{lid}", data={"data": '{"images": []}'}, files=two, headers=auth("owner"))
    assert res.status_code == 429
    one = [("files", ("x.png", png_bytes(), "image/png"))]
    res = client.put(f"/api/listings/{lid}", data={"data": '{"images": []}'}, files=one, headers=auth("owner"))
    assert res.status_code == 200  # the refused upload didn't use up any of the allowance


def test_rejected_photos_dont_use_the_allowance(client, auth, monkeypatch):
    monkeypatch.setattr(quotas.photo_limiter, "limit", 1)
    bad = [("files", ("x.png", b"not an image", "image/png"))]
    assert client.post("/api/listings", data={"data": "{}"}, files=bad, headers=auth("owner")).status_code in (400, 422)
    assert post_listing(client, auth("owner"), LISTING).status_code == 200


def test_avatar_upload_limit(client, auth, monkeypatch):
    monkeypatch.setattr(quotas.avatar_limiter, "limit", 2)
    pic = lambda: {"file": ("me.png", png_bytes(), "image/png")}  # noqa: E731
    for _ in range(2):
        assert client.post("/api/users/me/avatar", files=pic(), headers=auth("buyer")).status_code == 200
    assert client.post("/api/users/me/avatar", files=pic(), headers=auth("buyer")).status_code == 429


def test_limiter_allows_n_at_once():
    limiter = SlidingWindowLimiter(3, 60)
    assert limiter.allow("u", 2)
    assert not limiter.allow("u", 2)  # would make 4: refused, records nothing
    assert limiter.allow("u", 1)
    assert not limiter.allow("u")


# ---------- E: security headers on the API ----------


def test_api_responses_carry_security_headers(client, auth):
    res = client.get("/api/users/me", headers=auth("buyer"))
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["X-Frame-Options"] == "DENY"
    assert "default-src 'none'" in res.headers["Content-Security-Policy"]
    assert "frame-ancestors 'none'" in res.headers["Content-Security-Policy"]
    assert "Strict-Transport-Security" not in res.headers  # only in production


def test_hsts_in_production(client, monkeypatch):
    import app.main as main

    monkeypatch.setattr(main, "_prod", True)
    res = client.get("/api/listings/popular")
    assert res.headers["Strict-Transport-Security"].startswith("max-age=63072000")


def test_error_answers_get_the_headers_too(client, auth, monkeypatch):
    from app.api.routes import notifications

    def boom(*a, **k):
        raise RuntimeError("bug")

    monkeypatch.setattr(notifications, "NotificationListOut", boom)
    res = client.get("/api/notifications", headers=auth("buyer"))
    assert res.status_code == 500
    assert "default-src 'none'" in res.headers["Content-Security-Policy"]


def test_resource_pdf_is_sandboxed(client, auth, create):
    rid = create().json()["id"]
    res = client.get(f"/api/resources/{rid}/file", headers=auth("owner"))
    assert res.status_code == 200
    assert res.headers["Content-Security-Policy"].startswith("sandbox")


# ---------- F: production settings are checked at startup ----------


def prod_settings(**overrides):
    values = dict(
        ENVIRONMENT="production",
        DATABASE_URL="sqlite://",
        JWT_SECRET_KEY="x" * 64,
        OTP_PEPPER="p" * 32,
        SMTP_USERNAME="u",
        SMTP_PASSWORD="p",
        SMTP_FROM="f@example.com",
        CORS_ORIGINS=["https://campusmarket.vercel.app"],
    )
    values.update(overrides)
    return Settings(_env_file=None, **values)


def test_good_production_settings_start():
    assert prod_settings().is_production


@pytest.mark.parametrize("overrides, problem", [
    ({"JWT_SECRET_KEY": "short"}, "JWT_SECRET_KEY"),
    ({"OTP_PEPPER": "short"}, "OTP_PEPPER"),
    ({"CORS_ORIGINS": ["*"]}, "'*'"),
    ({"CORS_ORIGINS": ["https://*.vercel.app"]}, "'*'"),
    ({"CORS_ORIGINS": ["http://localhost:5173"]}, "https://"),
    ({"CORS_ORIGINS": []}, "empty"),
])
def test_unsafe_production_settings_refuse_to_start(overrides, problem):
    with pytest.raises(ValidationError) as e:
        prod_settings(**overrides)
    assert problem in str(e.value)


def test_development_is_not_checked():
    assert not prod_settings(ENVIRONMENT="development", JWT_SECRET_KEY="dev", CORS_ORIGINS=["http://localhost:5173"]).is_production


# ---------- G: only the owner can undo the owner's suspension ----------


@pytest.fixture
def owner_is_site_owner(monkeypatch):
    monkeypatch.setattr(settings, "OWNER_EMAILS", ["owner@campus.edu"])


def test_admin_cant_reinstate_someone_the_owner_suspended(client, auth, users, owner_is_site_owner):
    target = users["buyer"].id
    assert client.post(f"/api/admin/users/{target}/suspend", json={"reason": "Scam"}, headers=auth("owner")).status_code == 200
    res = client.post(f"/api/admin/users/{target}/reinstate", headers=auth("admin"))
    assert res.status_code == 403
    assert client.post(f"/api/admin/users/{target}/reinstate", headers=auth("owner")).status_code == 200


def test_admin_can_still_undo_an_admins_suspension(client, auth, users, db_session, owner_is_site_owner):
    db, _ = db_session
    _user(db, "admin2@campus.edu", role="admin")
    target = users["buyer"].id
    assert client.post(f"/api/admin/users/{target}/suspend", json={"reason": "Oops"}, headers=auth("admin")).status_code == 200
    assert client.post(f"/api/admin/users/{target}/reinstate", headers=auth("admin")).status_code == 200
