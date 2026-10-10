from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base


class Notification(Base):
    """Something another student did that the recipient should know about.

    type "access_request": actor asked for access to the recipient's resource.
    type "contact": actor tapped WhatsApp / Email on the recipient's listing or resource.
    type "report": actor reported the recipient's item (shown anonymously; note = reason).
    (The app can't see whether a message was actually sent, only that they opened it.)
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(20), nullable=False)  # access_request | contact | report
    channel = Column(String(10), nullable=True)  # whatsapp | email (contact only)
    target_type = Column(String(10), nullable=False)  # listing | resource
    target_id = Column(Integer, nullable=False)
    target_title = Column(String(120), nullable=False)  # snapshot, so it still reads well if the item is deleted
    note = Column(String(200), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)

    actor = relationship("User", foreign_keys=[actor_id])
