import uuid
from datetime import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String
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
    # argon2id hash. Null for accounts created before passwords existed: they must set one
    # (see get_current_user) before using anything else.
    password_hash = Column(String(255), nullable=True)
    failed_logins = Column(Integer, nullable=False, default=0, server_default="0")
    locked_until = Column(DateTime, nullable=True)
    # Login sessions issued before this moment are rejected (set on every password change).
    password_changed_at = Column(DateTime, nullable=True)
    # Google account id ("sub") once the student has used "Continue with Google".
    google_sub = Column(String(255), nullable=True, unique=True, index=True)
    profile_completed = Column(Boolean, default=False)
    interests = Column(ARRAY(String), nullable=False, default=list, server_default="{}")
    # Recent things this user opened, for recommendations: [{"kind": "listing"|"resource",
    # "key": <category or subject>, "ts": <epoch ms>}], newest last, capped at VIEW_HISTORY_MAX.
    view_history = Column(JSON, nullable=False, default=list, server_default="[]")
    created_at = Column(DateTime, default=datetime.utcnow)
    # Set when an admin suspends the account for breaking the rules: every session stops
    # working and their listings/resources disappear. The email also goes on banned_emails.
    suspended_at = Column(DateTime, nullable=True)
    suspension_reason = Column(String(300), nullable=True)

    @property
    def has_password(self) -> bool:
        return bool(self.password_hash)

    @property
    def uses_google(self) -> bool:
        return bool(self.google_sub)

    @property
    def needs_password(self) -> bool:
        """Old email-only accounts must create a password before anything else. Google accounts
        don't need one (Google already proves who they are); they can add one in Profile."""
        return not self.password_hash and not self.google_sub

    @property
    def is_owner(self) -> bool:
        """Configured in OWNER_EMAILS; can approve/remove admins and can never be locked out."""
        return (self.email or "").lower() in {e.lower() for e in settings.OWNER_EMAILS}

    @property
    def is_admin(self) -> bool:
        """Owners, plus users an owner approved (role "admin")."""
        return self.role == "admin" or self.is_owner
