
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.core.timeutil import utcnow


class ProductRequest(Base):
    """A "Looking for…" post from any student, shown to sellers as a notification."""

    __tablename__ = "product_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    product = Column(String(70), nullable=False)
    description = Column(String(70), nullable=True)
    created_at = Column(DateTime, default=utcnow, nullable=False, index=True)

    user = relationship("User")
