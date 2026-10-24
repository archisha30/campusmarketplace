
from sqlalchemy import JSON, Column, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.base import Base
from app.core.timeutil import utcnow


class Draft(Base):
    """An unfinished listing or resource, saved from the Sell / Post a Resource forms.

    `data` holds the form fields as typed (nothing is validated until it's published).
    Photos and PDFs aren't kept: they're added when the draft is published.
    """

    __tablename__ = "drafts"
    __table_args__ = (Index("ix_drafts_user_updated", "user_id", "updated_at"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = Column(String(10), nullable=False)  # listing | resource
    data = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=utcnow, nullable=False)
    updated_at = Column(DateTime, default=utcnow, nullable=False)
