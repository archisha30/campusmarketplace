import hashlib
import hmac
import secrets
import string
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.bans import SUSPENDED
from app.core.config import settings
from app.db.session import get_db  # <-- point this at your existing db session dependency
from app.models.user import User

optional_bearer_scheme = HTTPBearer(auto_error=False)


def generate_otp(length: int = 6) -> str:
    return "".join(secrets.choice(string.digits) for _ in range(length))


def hash_otp(otp: str) -> str:
    return hashlib.sha256(f"{otp}{settings.OTP_PEPPER}".encode()).hexdigest()


def verify_otp(otp: str, hashed: str) -> bool:
    return hmac.compare_digest(hash_otp(otp), hashed)


# --- Passwords (argon2id; never store or log the plain text) ---

_hasher = PasswordHasher()
# Checked against when the email doesn't exist, so a wrong email takes as long as a wrong password.
_DUMMY_HASH = _hasher.hash("not-a-real-password-0")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    # iat lets a password change log out every session issued before it (see _check_session).
    payload = {"sub": str(user_id), "exp": expire, "iat": int(now.timestamp())}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> tuple[uuid.UUID, int]:
    """(user id, issued-at seconds). Raises 401 for anything invalid or expired."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return uuid.UUID(payload["sub"]), int(payload.get("iat", 0))
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired, log in again")
    except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")


def session_token(request: Request, credentials: HTTPAuthorizationCredentials | None) -> str | None:
    """The browser sends the session as an HttpOnly cookie. A Bearer header is still accepted
    for tests, scripts and moving old browser-stored sessions into the cookie."""
    if credentials:
        return credentials.credentials
    return request.cookies.get(settings.SESSION_COOKIE_NAME)


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        settings.SESSION_COOKIE_NAME,
        token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=True,  # page scripts can't read it
        secure=settings.ENVIRONMENT.lower() not in ("development", "test"),
        samesite="lax",  # not sent on cross-site form posts or background requests
        path="/api",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(settings.SESSION_COOKIE_NAME, path="/api")


def get_current_user_any(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Any logged-in user, including accounts that still have to create a password.
    Only GET /users/me, POST /auth/set-password and session renewal use this directly."""
    token = session_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Log in to continue")
    user_id, issued_at = decode_access_token(token)
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    if not _session_still_valid(user, issued_at):
        raise HTTPException(status_code=401, detail="Your password was changed. Log in again.")
    if user.suspended_at:
        raise HTTPException(status_code=403, detail=SUSPENDED)
    return user


def _session_still_valid(user: User, issued_at: int) -> bool:
    """Sessions issued before the latest password change are dead (e.g. a stolen token
    stops working the moment the owner resets their password)."""
    changed = user.password_changed_at
    if not changed:
        return True
    return issued_at >= int(changed.replace(tzinfo=timezone.utc).timestamp())


PASSWORD_REQUIRED = {"code": "password_required", "message": "Create a password to continue"}


def get_current_user(user: User = Depends(get_current_user_any)) -> User:
    """Logged in AND has a password. Accounts created before passwords existed are blocked
    from everything (all other dependencies build on this one) until they set one."""
    if user.needs_password:
        raise HTTPException(status_code=403, detail=PASSWORD_REQUIRED)
    return user


def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Like get_current_user, but guests (no or bad token) get None instead of a 401.
    Accounts that still need to create a password are treated as guests too."""
    token = session_token(request, credentials)
    if not token:
        return None
    try:
        user_id, issued_at = decode_access_token(token)
    except HTTPException:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.needs_password or not _session_still_valid(user, issued_at):
        return None
    return user


def require_verified(user: User = Depends(get_current_user)) -> User:
    """Logged in AND verified college email. Guards everything marketplace-related."""
    if not user.verified:
        raise HTTPException(status_code=403, detail="Verify your college email first")
    return user


def require_seller(user: User = Depends(get_current_user)) -> User:
    if user.account_type != "seller" and not user.is_admin:
        raise HTTPException(status_code=403, detail="Only seller accounts can list items")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """The owner(s) in OWNER_EMAILS and the admins they approved."""
    if not user.is_admin or not user.verified:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def require_owner(user: User = Depends(get_current_user)) -> User:
    """Only owners can approve or remove admins."""
    if not user.is_owner or not user.verified:
        raise HTTPException(status_code=403, detail="Only the owner can change who is an admin")
    return user
