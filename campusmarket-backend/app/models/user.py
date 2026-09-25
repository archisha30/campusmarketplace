import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.dialects.postgresql import UUID

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
    verified = Column(Boolean, default=False)
    profile_completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
