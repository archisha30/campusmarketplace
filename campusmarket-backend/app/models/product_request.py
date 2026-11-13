
from datetime import timedelta

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.core.timeutil import utcnow

# Requests older than this drop off sellers' dashboards and stop matching new listings (so do
# ones marked found).
VISIBLE_FOR = timedelta(days=30)


class ProductRequest(Base):
    """A "Looking for…" post from any student, shown to sellers as a notification."""

    __tablename__ = "product_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product = Column(String(70), nullable=False)
    description = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)
    # Set when the student taps "Found it": sellers stop seeing it and new items stop matching it.
    found_at = Column(DateTime, nullable=True)

    user = relationship("User")
