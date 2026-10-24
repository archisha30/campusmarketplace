from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base


class BannedEmail(Base):
    """Emails that can never sign up, log in or use Google sign-in again (see core/bans.py).
    Added when an admin suspends an account; removed only if an admin reinstates it."""

    __tablename__ = "banned_emails"

    email = Column(String, primary_key=True)  # always lowercase
    reason = Column(String(300), nullable=False)
    banned_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
