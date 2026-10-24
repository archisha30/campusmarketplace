"""OTP email: Brevo over HTTPS when configured, SMTP otherwise, and a fast, readable failure."""

import smtplib

import httpx
import pytest

from app.core import email as email_module
from app.core.email import EmailError, send_otp_email

# These tests check the real sending code against fake Brevo/SMTP servers, so they use the
# real _deliver instead of the suite-wide "no real email" stub.
_REAL_DELIVER = email_module._deliver


@pytest.fixture(autouse=True)
def real_delivery(no_real_email, monkeypatch):
    monkeypatch.setattr(email_module, "_deliver", _REAL_DELIVER)


@pytest.fixture
def settings(monkeypatch):
    s = email_module.settings
    monkeypatch.setattr(s, "SMTP_FROM", "sender@gmail.com")
    monkeypatch.setattr(s, "BREVO_API_KEY", None)
    return s


def test_brevo_used_when_key_set(settings, monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "xkeysib-test")
    calls = []

    def fake_post(url, headers, json, timeout):
        calls.append((url, headers, json, timeout))
        return httpx.Response(201, json={"messageId": "1"})

    monkeypatch.setattr(email_module.httpx, "post", fake_post)
    send_otp_email("student@campus.edu", "123456")

    url, headers, body, timeout = calls[0]
    assert url == "https://api.brevo.com/v3/smtp/email"
    assert headers["api-key"] == "xkeysib-test"
    assert body["sender"]["email"] == "sender@gmail.com"
    assert body["to"] == [{"email": "student@campus.edu"}]
    assert "123456" in body["textContent"]
    assert "123456" in body["htmlContent"] and "<table" in body["htmlContent"]
    assert body["subject"] == "123456 is your CampusMarket code"
    assert timeout == email_module.SEND_TIMEOUT


def test_brevo_rejection_raises(settings, monkeypatch):
    monkeypatch.setattr(settings, "BREVO_API_KEY", "bad")
    monkeypatch.setattr(email_module.httpx, "post", lambda *a, **k: httpx.Response(401, json={"message": "Key not found"}))
    with pytest.raises(EmailError, match="401"):
        send_otp_email("student@campus.edu", "123456")


def test_smtp_has_timeout_and_blocked_port_raises(settings, monkeypatch):
    seen = {}

    def blocked(host, port, timeout=None):
        seen["timeout"] = timeout
        raise TimeoutError("timed out")

    monkeypatch.setattr(email_module.smtplib, "SMTP", blocked)
    with pytest.raises(EmailError, match="SMTP send"):
        send_otp_email("student@campus.edu", "123456")
    assert seen["timeout"] == email_module.SEND_TIMEOUT


def test_smtp_auth_failure_raises(settings, monkeypatch):
    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self): pass
        def login(self, *a): raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)
    with pytest.raises(EmailError):
        send_otp_email("student@campus.edu", "123456")


def test_signup_email_failure_is_logged_not_leaked(client, monkeypatch, caplog):
    """Signup emails go out after the response (so timing can't reveal accounts); a failure
    is logged for us, and the student simply asks for another code."""
    from app.api.routes import auth as auth_routes

    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])

    def fail(*a):
        raise EmailError("SMTP blocked")

    monkeypatch.setattr(auth_routes, "send_otp_email", fail)
    res = client.post("/api/auth/signup", json={"email": "new@campus.edu", "account_type": "buyer"})
    assert res.status_code == 200
    assert "SMTP blocked" in caplog.text


def test_reset_email_says_reset_and_signup_says_verify():
    from app.core.email_templates import otp_email

    _, text, html = otp_email("654321", "reset")
    assert "Reset your password" in html and "654321" in text
    _, _, html = otp_email("654321", "signup")
    assert "Verify your email" in html


def test_smtp_sends_html_and_text_parts(settings, monkeypatch):
    sent = {}

    class FakeSMTP:
        def __init__(self, *a, **k): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def starttls(self): pass
        def login(self, *a): pass
        def sendmail(self, frm, to, raw): sent["raw"] = raw

    monkeypatch.setattr(email_module.smtplib, "SMTP", FakeSMTP)
    send_otp_email("student@campus.edu", "123456")
    assert "multipart/alternative" in sent["raw"]
    assert "text/plain" in sent["raw"] and "text/html" in sent["raw"]
