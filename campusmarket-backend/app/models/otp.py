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
