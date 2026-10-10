from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Report(Base):
    """A student flagging a listing or resource. The seller is notified (anonymously);
    admins see who reported it and resolve it."""

    __tablename__ = "reports"
    __table_args__ = (
        UniqueConstraint("reporter_id", "target_type", "target_id", name="uq_reports_reporter_target"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    reporter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String(10), nullable=False)  # listing | resource
    target_id = Column(Integer, nullable=False)
    target_title = Column(String(120), nullable=False)  # snapshot, so it still reads well if the item is deleted
    reason = Column(String(40), nullable=False)
    details = Column(String(300), nullable=True)
    status = Column(String(10), nullable=False, default="open")  # open | resolved
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    reporter = relationship("User", foreign_keys=[reporter_id])
    owner = relationship("User", foreign_keys=[owner_id])
