"""Branded HTML emails (with plain-text versions for clients that don't show HTML).

Email HTML is old-fashioned on purpose: tables and inline styles only, no external CSS,
web fonts or images, so it looks the same in Gmail, Outlook and phone mail apps.
"""

from html import escape

from app.core.config import settings

# CampusMarket colours (tailwind.config.js), on a dark card like the app's navbar logo.
PAGE_BG = "#0F1115"
CARD_BG = "#15181F"
CARD_LINE = "#2A2E37"
BRAND = "#2F4CFF"
SUN = "#FFD23F"
TEXT = "#F3F4F6"
MUTED = "#A7ACB8"
FAINT = "#7C8290"
CODE_BG = "#1A2466"
FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

TAGLINE = "Your campus. Your marketplace."


def _logo() -> str:
    # The app's logo (blue tile with a yellow square), drawn with table cells so no image is needed.
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">'
        f'<tr><td style="width:44px;height:44px;background:{BRAND};border-radius:12px;" align="center" valign="middle">'
        f'<table role="presentation" cellpadding="0" cellspacing="0"><tr>'
        f'<td style="width:18px;height:18px;background:{SUN};border-radius:5px;font-size:0;line-height:0;">&nbsp;</td>'
        f"</tr></table></td></tr></table>"
    )


def _button(label: str, url: str) -> str:
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr>'
        f'<td style="background:{BRAND};border-radius:999px;">'
        f'<a href="{escape(url)}" style="display:inline-block;padding:13px 26px;font-family:{FONT};'
        f'font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;">{escape(label)}</a>'
        f"</td></tr></table>"
    )


def _layout(preheader: str, body_html: str) -> str:
    """The frame every email shares: logo header, the message card, and a footer."""
    domains = " · ".join(f"@{d}" for d in settings.ALLOWED_EMAIL_DOMAINS)
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>CampusMarket</title>
</head>
<body style="margin:0;padding:0;background:{PAGE_BG};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:{PAGE_BG};">{escape(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE_BG};">
<tr><td align="center" style="padding:28px 14px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:520px;background:{CARD_BG};border:1px solid {CARD_LINE};border-radius:22px;">
    <tr><td align="center" style="padding:32px 28px 24px;border-bottom:1px solid {CARD_LINE};">
      {_logo()}
      <div style="font-family:{FONT};font-size:28px;font-weight:800;color:{TEXT};letter-spacing:-0.3px;">CampusMarket</div>
      <div style="font-family:{FONT};font-size:15px;color:{MUTED};margin-top:6px;">{TAGLINE}</div>
    </td></tr>
    <tr><td style="padding:28px 28px 8px;font-family:{FONT};">
      {body_html}
    </td></tr>
  </table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
    <tr><td align="center" style="padding:18px 20px 0;font-family:{FONT};font-size:12px;line-height:18px;color:{FAINT};">
      Sent by CampusMarket, the marketplace for verified students ({escape(domains)}).<br>
      <a href="{escape(settings.SITE_URL)}" style="color:{FAINT};text-decoration:underline;">{escape(settings.SITE_URL.removeprefix("https://"))}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>"""


def _heading(text: str) -> str:
    return f'<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:{TEXT};">{escape(text)}</h1>'


def _para(html: str, size: int = 16, color: str = MUTED, margin: str = "0 0 20px") -> str:
    return f'<p style="margin:{margin};font-size:{size}px;line-height:1.6;color:{color};">{html}</p>'


OTP_COPY = {
    "signup": ("Verify your email", "Enter this code to finish creating your CampusMarket account:"),
    "reset": ("Reset your password", "We got a request to reset your CampusMarket password. Enter this code to choose a new one:"),
}


def otp_email(otp: str, purpose: str = "signup") -> tuple[str, str, str]:
    """(subject, plain text, html) for a 6-digit code."""
    title, intro = OTP_COPY.get(purpose, OTP_COPY["signup"])
    minutes = settings.OTP_EXPIRE_MINUTES
    subject = f"{otp} is your CampusMarket code"

    body = (
        _heading(title)
        + _para(escape(intro))
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">'
        f'<tr><td align="center" style="background:{CODE_BG};border-radius:14px;padding:22px 10px;">'
        f'<span style="font-family:\'SF Mono\',Menlo,Consolas,\'Courier New\',monospace;font-size:38px;'
        f'font-weight:700;letter-spacing:10px;color:#FFFFFF;">{escape(otp)}</span>'
        f"</td></tr></table>"
        + f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">'
        f'<tr><td style="border:1px solid {CARD_LINE};border-radius:12px;padding:14px 16px;'
        f'font-size:14px;line-height:1.6;color:{MUTED};">'
        f'⏱ <strong style="color:{TEXT};">Expires in {minutes} minutes.</strong><br>'
        f'🔒 <strong style="color:{TEXT};">Security notice:</strong> never share this code with anyone. '
        f"CampusMarket will never ask you for it."
        f"</td></tr></table>"
        + _para("If you didn't request this code, you can ignore this email. Your account stays safe.", size=14, color=FAINT)
    )
    text = (
        f"{title}\n\n{intro}\n\n    {otp}\n\n"
        f"This code expires in {minutes} minutes. Never share it with anyone; CampusMarket will never ask you for it.\n\n"
        f"If you didn't request this code, you can ignore this email.\n\n"
        f"CampusMarket · {settings.SITE_URL}"
    )
    return subject, text, _layout(f"Your code is {otp}. It expires in {minutes} minutes.", body)


def account_exists_email() -> tuple[str, str, str]:
    """Sent instead of a signup code when the address already has an account."""
    subject = "You already have a CampusMarket account"
    login_url = settings.SITE_URL.rstrip("/") + "/login"
    body = (
        _heading("You already have an account")
        + _para("Someone (hopefully you) just tried to sign up to CampusMarket with this email. "
                "You already have an account, so just log in.")
        + _button("Log in to CampusMarket", login_url)
        + _para('Forgot your password? Use <strong style="color:#F3F4F6;">Forgot password?</strong> on the login page.', size=14)
        + _para("If this wasn't you, you can ignore this email. Nothing has changed on your account.", size=14, color=FAINT)
    )
    text = (
        "Someone (hopefully you) just tried to sign up to CampusMarket with this email.\n\n"
        f"You already have an account, so just log in: {login_url}\n"
        "If you don't remember your password, use \"Forgot password?\" on the login page.\n\n"
        "If this wasn't you, you can ignore this email."
    )
    return subject, text, _layout("You already have an account. Just log in.", body)
