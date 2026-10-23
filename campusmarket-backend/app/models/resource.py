from datetime import datetime

from sqlalchemy import JSON, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Resource(Base):
    """Study material for sale or given away free, as a soft copy (PDF / drive link) or hard copy."""

    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    title = Column(String(120), nullable=False)
    subject = Column(String(60), nullable=False, index=True)
    year = Column(String(3), nullable=False, default="any")  # "1" | "2" | "3" | "4" | "any"
    copy_type = Column(String(4), nullable=False)  # soft | hard
    offer_type = Column(String(4), nullable=False)  # sale | free
    price = Column(Integer, nullable=False, default=0)  # whole rupees, 0 when free
    description = Column(String(500), nullable=True)
    status = Column(String(10), nullable=False, default="available")  # available | closed

    # Soft copies: "pdf" (we host the file) or "drive" (external link). Hard copies: null.
    delivery = Column(String(5), nullable=True)
    drive_url = Column(String(500), nullable=True)
    pickup_spot = Column(String(120), nullable=True)  # hard copies only
    upi_id = Column(String(100), nullable=True)

    # Private file name under PRIVATE_DIR. The full resource when delivery == "pdf",
    # otherwise an optional sample (required for drive links).
    file_name = Column(String(64), nullable=True)
    page_count = Column(Integer, nullable=True)
    # Public preview JPEG names under uploads/, e.g. [{"name": "...jpg", "kind": "sharp"}]
    preview_pages = Column(JSON, nullable=False, default=list)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    # Set when the owner deletes it; restorable for 24h from the Deleted tab (see core/trash.py).
    deleted_at = Column(DateTime, nullable=True, index=True)

    owner = relationship("User")
    access_requests = relationship(
        "ResourceAccess", back_populates="resource", cascade="all, delete-orphan", passive_deletes=True
    )


class ResourceAccess(Base):
    """A buyer's request to unlock a paid resource. Payment happens offline (UPI / cash)."""

    __tablename__ = "resource_access"
    __table_args__ = (UniqueConstraint("resource_id", "user_id", name="uq_resource_access_resource_user"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(Integer, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String(8), nullable=False, default="pending")  # pending | approved | denied
    note = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    decided_at = Column(DateTime, nullable=True)

    resource = relationship("Resource", back_populates="access_requests")
    user = relationship("User")
