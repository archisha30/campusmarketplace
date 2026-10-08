import uuid
from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Listing(Base):
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String, nullable=False)
    category = Column(String, nullable=False)
    listing_type = Column(String, nullable=False, default="sale")  # sale | rent | free
    price = Column(Float, nullable=False, default=0)
    condition = Column(String, nullable=False)
    description = Column(String, nullable=True)
    pickup_spot = Column(String, nullable=False)

    status = Column(String, nullable=False, default="available")  # available | reserved | sold
    images = Column(ARRAY(String), nullable=False, default=list)

    # F&B only: served "hot" or "cold" (required for F&B), and an optional expiry date.
    # Expired F&B listings drop out of the marketplace automatically.
    food_temp = Column(String(4), nullable=True)
    expiry_date = Column(Date, nullable=True)

    # Single-campus for now — see ALLOWED_EMAIL_DOMAINS in core/config.py.
    campus_id = Column(Integer, nullable=False, default=1)

    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User")
