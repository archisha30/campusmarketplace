
from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class WishlistItem(Base):
    """A listing a student saved with the heart button. Stored on the server so the
    wishlist follows them to every device."""

    __tablename__ = "wishlist_items"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
