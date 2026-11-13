from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class RequestDismissal(Base):
    """A seller hid a "Looking for" request from their feed with the ×. Stored on the server so
    it stays hidden on every device; the request itself is untouched for everyone else."""

    __tablename__ = "request_dismissals"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    request_id = Column(Integer, ForeignKey("product_requests.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
