from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class ListingView(Base):
    """A student opened a listing (once per student, however often they come back), so the
    landing page can show the listings the most students clicked on. The seller's own visits
    don't count."""

    __tablename__ = "listing_views"

    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
