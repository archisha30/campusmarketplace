
from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.core.timeutil import utcnow


class Notification(Base):
    """Something another student did that the recipient should know about.

    type "access_request": actor asked for access to the recipient's resource.
    type "access_approved" / "access_denied": the resource owner (actor) answered the recipient's
      access request (note "revoked" when access they had was taken away).
    type "contact": actor tapped WhatsApp / Email on the recipient's listing or resource.
    type "report": actor reported the recipient's item (shown anonymously; note = reason).
      Repeat reports on the same item update one unread notification (count = open reports).
    type "removed": an admin removed the recipient's item (note = the reason they gave).
    type "report_cleared": an admin reviewed the reports on the item and it stays up.
    type "held": enough students reported the item that it's hidden until an admin reviews it
      (note = the report reasons; never who reported it).
    (The app can't see whether a message was actually sent, only that they opened it.)
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_created", "user_id", "created_at"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    # access_request | access_approved | access_denied | contact | report | removed | report_cleared | held
    type = Column(String(20), nullable=False)
    channel = Column(String(10), nullable=True)  # whatsapp | email (contact only)
    target_type = Column(String(10), nullable=False)  # listing | resource
    target_id = Column(Integer, nullable=False)
    target_title = Column(String(120), nullable=False)  # snapshot, so it still reads well if the item is deleted
    note = Column(String(300), nullable=True)
    count = Column(Integer, nullable=False, default=1, server_default="1")  # reports this notification stands for
    created_at = Column(DateTime, default=utcnow, nullable=False)
    read_at = Column(DateTime, nullable=True)

    actor = relationship("User", foreign_keys=[actor_id])
