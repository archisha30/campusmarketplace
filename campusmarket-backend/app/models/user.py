import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID

from app.core.config import settings
from app.db.base import Base  # <-- point this at your existing declarative Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=True)
    college = Column(String, nullable=True)
    course = Column(String, nullable=True)
    year = Column(String, nullable=True)
    role = Column(String, default="student")  # "student" or "admin"
    account_type = Column(String, nullable=False, default="buyer", server_default="buyer")  # "buyer" or "seller"
    avatar_url = Column(String, nullable=True)
    phone = Column(String, nullable=True)  # digits with country code, e.g. "919876543210"
    verified = Column(Boolean, default=False)
    profile_completed = Column(Boolean, default=False)
    interests = Column(ARRAY(String), nullable=False, default=list, server_default="{}")
    # Recent things this user opened, for recommendations: [{"kind": "listing"|"resource",
    # "key": <category or subject>, "ts": <epoch ms>}], newest last, capped at VIEW_HISTORY_MAX.
    view_history = Column(JSON, nullable=False, default=list, server_default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def is_owner(self) -> bool:
        """Configured in OWNER_EMAILS; can approve/remove admins and can never be locked out."""
        return (self.email or "").lower() in {e.lower() for e in settings.OWNER_EMAILS}

    @property
    def is_admin(self) -> bool:
        """Owners, plus users an owner approved (role "admin")."""
        return self.role == "admin" or self.is_owner
