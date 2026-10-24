
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class ContactReveal(Base):
    """One student seeing one person's phone/email (via Contact Seller, etc.).
    Logged so nobody can quietly collect everyone's numbers: reveals are rate-limited per student."""

    __tablename__ = "contact_reveals"
    __table_args__ = (Index("ix_contact_reveals_user_created", "user_id", "created_at"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_type = Column(String(10), nullable=False)  # listing | resource | request
    target_id = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=utcnow, nullable=False)
