from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class ResourceWishlistItem(Base):
    """A Resource Hub item a student saved with the heart button, like WishlistItem for listings."""

    __tablename__ = "resource_wishlist_items"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True, index=True)
    created_at = Column(DateTime, default=utcnow, nullable=False)
