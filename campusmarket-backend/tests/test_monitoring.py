"""Sentry is off without a DSN, and never receives anything that identifies a student."""

from app.core import monitoring


def test_off_without_a_dsn(monkeypatch):
    monkeypatch.setattr(monitoring.settings, "SENTRY_DSN", None)
    assert monitoring.setup_sentry() is False


def test_events_are_scrubbed_of_personal_data():
    event = {
        "user": {"email": "student@campus.edu", "ip_address": "1.2.3.4"},
        "request": {
            "method": "POST",
            "url": "https://api/api/auth/login",
            "data": {"email": "student@campus.edu", "password": "hunter22"},
            "cookies": {"cm_session": "token"},
            "env": {"REMOTE_ADDR": "1.2.3.4"},
            "headers": {"Authorization": "Bearer token", "Cookie": "cm_session=token",
                        "X-Forwarded-For": "1.2.3.4", "User-Agent": "Mozilla"},
        },
        "exception": {"values": [{"type": "RuntimeError", "stacktrace": {"frames": [
            {"function": "login", "vars": {"payload": "password='hunter22'", "token": "token"}}]}}]},
    }
    out = monitoring.scrub(event)
    text = str(out)
    for secret in ("student@campus.edu", "hunter22", "token", "1.2.3.4"):
        assert secret not in text, secret
    assert out["request"]["headers"] == {"User-Agent": "Mozilla"}
    assert out["exception"]["values"][0]["type"] == "RuntimeError"  # the error itself still goes
    assert out["exception"]["values"][0]["stacktrace"]["frames"][0]["function"] == "login"
