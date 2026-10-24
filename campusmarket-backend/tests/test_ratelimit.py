"""Per-IP limits can't be dodged by faking X-Forwarded-For, and the limiter forgets old keys."""

import pytest
from starlette.requests import Request

from app.api.routes import auth as auth_routes
from app.core import ratelimit
from app.core.ratelimit import SlidingWindowLimiter, client_ips


def _request(xff: str | None = None, peer: str = "10.0.0.1") -> Request:
    headers = [(b"x-forwarded-for", xff.encode())] if xff is not None else []
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


# What Render appends after the sender's entries: Cloudflare, then its own load balancer.
RENDER = "172.71.202.166, 10.196.107.79"


@pytest.mark.parametrize("xff, expected", [
    (None, ("10.0.0.1", "10.0.0.1")),  # local development: no proxy
    (f"203.0.113.9, {RENDER}", ("203.0.113.9", "203.0.113.9")),  # someone calling Render directly
    (f"1.2.3.4, 76.76.21.21, {RENDER}", ("76.76.21.21", "1.2.3.4")),  # via Vercel: student, then Vercel
    (f"6.6.6.6, 1.2.3.4, 76.76.21.21, {RENDER}", ("76.76.21.21", "1.2.3.4")),  # extra faked entries are ignored
    ("10.196.107.79", ("10.0.0.1", "10.0.0.1")),  # fewer entries than Render adds: use the peer
    (" , ", ("10.0.0.1", "10.0.0.1")),
])
def test_client_ips(xff, expected):
    assert client_ips(_request(xff), proxy_hops=3) == expected


def _login(client, xff):
    return client.post(
        "/api/auth/login",
        json={"email": "nobody@campus.edu", "password": "whatever123"},
        headers={"X-Forwarded-For": xff},
    ).status_code


def test_faked_addresses_still_hit_the_edge_limit(client, monkeypatch):
    """Calling Render directly with a new fake address each time used to mean no limit at all."""
    monkeypatch.setattr(auth_routes._unknown_email_failures, "limit", 100)
    monkeypatch.setattr(auth_routes._login_ip_limiter, "limit", 2)
    monkeypatch.setattr(auth_routes._login_edge_limiter, "limit", 4)
    codes = [_login(client, f"6.6.6.{i}, 203.0.113.9, {RENDER}") for i in range(6)]
    assert codes == [401, 401, 401, 401, 429, 429]


def test_students_behind_vercel_have_their_own_limits(client, monkeypatch):
    monkeypatch.setattr(auth_routes._unknown_email_failures, "limit", 100)
    monkeypatch.setattr(auth_routes._login_ip_limiter, "limit", 2)
    vercel = "76.76.21.21"
    assert [_login(client, f"1.1.1.1, {vercel}, {RENDER}") for _ in range(3)] == [401, 401, 429]
    # Another student on the same Vercel server isn't affected.
    assert _login(client, f"2.2.2.2, {vercel}, {RENDER}") == 401


@pytest.fixture
def sent(monkeypatch):
    box = []
    monkeypatch.setattr(auth_routes, "send_otp_email", lambda email, otp, *purpose: box.append(email))
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    return box


def test_codes_from_faked_addresses_hit_the_edge_limit(client, sent, monkeypatch):
    monkeypatch.setattr(auth_routes._code_edge_limiter, "limit", 2)
    codes = [
        client.post(
            "/api/auth/signup",
            json={"email": f"s{i}@campus.edu", "account_type": "buyer"},
            headers={"X-Forwarded-For": f"6.6.6.{i}, 203.0.113.9, {RENDER}"},
        ).status_code
        for i in range(3)
    ]
    assert codes == [200, 200, 429]


def test_limiter_forgets_idle_keys(monkeypatch):
    clock = [0.0]
    monkeypatch.setattr(ratelimit.time, "monotonic", lambda: clock[0])
    monkeypatch.setattr(ratelimit, "SWEEP_EVERY", 3)
    limiter = SlidingWindowLimiter(limit=5, window_seconds=60)
    limiter.allow("old-1")
    limiter.allow("old-2")
    clock[0] = 120  # both keys are now outside the window
    limiter.allow("new")  # third call sweeps
    assert set(limiter._hits) == {"new"}
