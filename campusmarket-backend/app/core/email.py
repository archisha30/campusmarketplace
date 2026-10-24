"""OTP and account emails (branded HTML from email_templates, plus a plain-text version).

Two ways to send, picked by settings:

* Brevo HTTP API (when BREVO_API_KEY is set): plain HTTPS, so it works on hosts that block
  outgoing SMTP, such as Render's free plan. Free tier: 300 emails/day.
* Gmail SMTP (default): fine locally.

Both have a hard time limit, so a blocked or slow mail server produces a clear error
instead of a request that hangs.
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx

from app.core.config import settings
from app.core.email_templates import account_exists_email, otp_email

log = logging.getLogger("campusmarket.email")

SEND_TIMEOUT = 15  # seconds
BREVO_URL = "https://api.brevo.com/v3/smtp/email"


class EmailError(RuntimeError):
    """The code couldn't be sent. The message is logged; users get a generic one."""


def _send_brevo(to_email: str, subject: str, body: str, html: str | None = None) -> None:
    try:
        res = httpx.post(
            BREVO_URL,
            headers={"api-key": settings.BREVO_API_KEY, "accept": "application/json"},
            json={
                "sender": {"email": settings.SMTP_FROM, "name": settings.EMAIL_FROM_NAME},
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body,
                **({"htmlContent": html} if html else {}),
            },
            timeout=SEND_TIMEOUT,
        )
    except httpx.HTTPError as e:
        raise EmailError(f"Brevo request failed: {e!r}") from e
    if res.status_code >= 400:
        raise EmailError(f"Brevo rejected the email: {res.status_code} {res.text}")


def _send_smtp(to_email: str, subject: str, body: str, html: str | None = None) -> None:
    if html:
        # Mail apps show the last part they can display: HTML where possible, text otherwise.
        msg = MIMEMultipart("alternative")
        msg.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))
    else:
        msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM
    msg["To"] = to_email
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=SEND_TIMEOUT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
    except (OSError, smtplib.SMTPException) as e:  # OSError covers timeouts and blocked ports
        raise EmailError(f"SMTP send via {settings.SMTP_HOST}:{settings.SMTP_PORT} failed: {e!r}") from e


def _deliver(to_email: str, subject: str, body: str, html: str | None = None) -> None:
    if settings.BREVO_API_KEY:
        _send_brevo(to_email, subject, body, html)
    else:
        _send_smtp(to_email, subject, body, html)


def send_otp_email(to_email: str, otp: str, purpose: str = "signup") -> None:
    """purpose: "signup" (verify a new account) or "reset" (forgot password)."""
    subject, text, html = otp_email(otp, purpose)
    _deliver(to_email, subject, text, html)


def send_account_exists_email(to_email: str) -> None:
    """Sent instead of a signup code when the email already has an account, so the signup
    form gives the same answer either way (nobody can probe which emails are registered)."""
    subject, text, html = account_exists_email()
    _deliver(to_email, subject, text, html)
