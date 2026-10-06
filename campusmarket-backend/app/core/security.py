import hashlib
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db  # <-- point this at your existing db session dependency
from app.models.user import User

bearer_scheme = HTTPBearer()
optional_bearer_scheme = HTTPBearer(auto_error=False)


def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_otp(otp: str) -> str:
    return hashlib.sha256(f"{otp}{settings.OTP_PEPPER}".encode()).hexdigest()


def verify_otp(otp: str, hashed: str) -> bool:
    return hash_otp(otp) == hashed


def create_access_token(user_id) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return uuid.UUID(payload["sub"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, log in again")
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    user_id = decode_access_token(credentials.credentials)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but guests (no or bad token) get None instead of a 401."""
    if not credentials:
        return None
    try:
        user_id = decode_access_token(credentials.credentials)
    except HTTPException:
        return None
    return db.query(User).filter(User.id == user_id).first()


def require_verified(user: User = Depends(get_current_user)) -> User:
    """Logged in AND verified college email. Guards everything marketplace-related."""
    if not user.verified:
        raise HTTPException(status_code=403, detail="Verify your college email first")
    return user


def require_seller(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "seller" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Only seller accounts can list items")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
