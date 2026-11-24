import uuid

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base  # <-- point this at your existing declarative Base
from app.core.timeutil import utcnow


class OTPCode(Base):
    __tablename__ = "otp_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, nullable=False, index=True)
    code_hash = Column(String, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    # What the code is for, so a signup code can't be used to reset a password, etc.
    purpose = Column(String(10), nullable=False, default="login", server_default="login")  # signup | login | reset
    attempts = Column(Integer, nullable=False, default=0, server_default="0")  # wrong guesses so far
    created_at = Column(DateTime, default=utcnow)


class OTPFailure(Base):
    """One row per wrong code, by email, across every code that email is sent. Codes are
    replaced each time a new one is asked for, so their own attempt counters can't stop
    someone guessing 5 times per fresh code; this caps wrong guesses per email per day
    (OTP_DAILY_FAILURE_LIMIT). Rows older than two days are cleared as new ones are added."""

    __tablename__ = "otp_failures"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=utcnow, index=True)
