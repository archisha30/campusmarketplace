"""Suspended accounts and banned emails. An admin suspends an account for breaking the
rules (admin.py): its sessions stop working, its listings and resources disappear
(core/trash.live), and the email can never sign up or log in again."""

from sqlalchemy.orm import Session

from app.models.banned_email import BannedEmail

SUSPENDED_MESSAGE = (
    "This account has been suspended for breaking CampusMarket's rules. "
    "If you think this is a mistake, contact the CampusMarket team."
)
BANNED_EMAIL_MESSAGE = "This email can't be used on CampusMarket. Its account was suspended for breaking the rules."
SUSPENDED = {"code": "account_suspended", "message": SUSPENDED_MESSAGE}


def is_banned(db: Session, email: str) -> bool:
    return db.query(BannedEmail).filter(BannedEmail.email == email.strip().lower()).first() is not None
