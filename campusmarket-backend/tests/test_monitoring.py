"""Sentry is off without a DSN, and never receives anything that identifies a student."""

import time

import pytest

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


@pytest.mark.parametrize("text", [
    "Brevo rejected the email: 400 {\"message\":\"student.name+x@campus.edu.in is blocked\"}",
    "SMTPRecipientsRefused({'student.name@campus.edu.in': (550, b'no such user')})",
    "/api/search?q=student.name%40campus.edu.in&page=2",
    "/api/search?next=%2Fa%3Fq%3Dstudent.name%2540campus.edu.in",
    "to=<Student.Name@Campus.EDU.IN>",
    "cut short: student.name@camp",
    "o'student.name@campus.edu.in",
])
def test_emails_in_error_text_are_hidden(text):
    hidden = monitoring.hide_emails(text)
    assert "[email]" in hidden
    for part in ("student.name", "camp", "o'"):
        assert part not in hidden.lower(), hidden


def test_emails_are_hidden_everywhere_in_an_event():
    address = "student@campus.edu"
    out = monitoring.scrub({
        "logentry": {"message": "Background email failed: %s", "params": [address], "formatted": f"failed: {address}"},
        "exception": {"values": [{"type": "EmailError", "value": f"rejected {address}"}]},
        "breadcrumbs": {"values": [{"message": f"sending to {address}", "data": {address: (address,)}}]},
        "request": {"url": "https://api/x", "query_string": "email=student%40campus.edu"},
        "level": "error", "timestamp": 1.5, "extra": None,
    })
    assert "student" not in str(out) and "campus" not in str(out)
    # The rest of the report still goes.
    assert out["logentry"]["message"] == "Background email failed: %s"
    assert out["exception"]["values"][0] == {"type": "EmailError", "value": "rejected [email]"}
    assert (out["level"], out["timestamp"], out["extra"]) == ("error", 1.5, None)


def test_ordinary_error_text_is_left_alone():
    for text in ("KeyError: 'price'", "@app.get('/health')", "GET /api/listings/12?page=2 -> 500", "50% off, 3.5 stars"):
        assert monitoring.hide_emails(text) == text


def test_hiding_emails_stays_fast_on_huge_messages():
    start = time.perf_counter()
    for filler in ("a", "a'", "%25", "a."):
        monitoring.hide_emails(filler * 50_000)
    assert time.perf_counter() - start < 5
