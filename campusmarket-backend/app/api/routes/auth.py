import time
import uuid
from datetime import timedelta

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, Response, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.bans import BANNED_EMAIL_MESSAGE, SUSPENDED_MESSAGE, is_banned
from app.core.config import settings
from app.core.email import EmailError, send_account_exists_email, send_otp_email
from app.core.google import GoogleTokenError, verify_google_token
from app.core.images import ImageError, check_image, read_upload
from app.core.ratelimit import SlidingWindowLimiter, client_ips
from app.core.security import (
    create_access_token,
    generate_otp,
    get_current_user,
    get_current_user_any,
    hash_otp,
    clear_session_cookie,
    hash_password,
    set_session_cookie,
    verify_otp,
    verify_password,
)
from app.api.routes.listings import _delete_upload_files
from app.core.storage import storage
from app.core.timeutil import utcnow
from app.db.session import get_db  # <-- point this at your existing db session dependency
from app.models.otp import OTPCode
from app.models.user import User
from app.schemas.auth import (
    AccountTypeRequest,
    ForgotPasswordRequest,
    GoogleLoginResponse,
    GoogleSignInRequest,
    InterestsRequest,
    LoginResponse,
    PasswordLoginRequest,
    ProfileRequest,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    SetPasswordRequest,
    SignupRequest,
    SignupVerifyRequest,
    UserOut,
    ViewsRequest,
)

router = APIRouter(prefix="/api", tags=["auth"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
VIEW_HISTORY_MAX = 50


def _check_domain(email: str) -> None:
    # Owners (OWNER_EMAILS) may use a personal address; everyone else needs a college email.
    if email.lower() in {e.lower() for e in settings.OWNER_EMAILS}:
        return
    domain = email.split("@")[-1].lower()
    if domain not in settings.ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f"{domain} is not a recognised campus email. Use your {_allowed_domains_text()} email")


def _check_not_banned(db: Session, email: str) -> None:
    if is_banned(db, email):
        raise HTTPException(status_code=403, detail=BANNED_EMAIL_MESSAGE)


def _allowed_domains_text() -> str:
    """'@a.edu.in' or '@a.edu.in or @b.com', for error messages."""
    names = [f"@{d}" for d in settings.ALLOWED_EMAIL_DOMAINS]
    return names[0] if len(names) == 1 else ", ".join(names[:-1]) + " or " + names[-1]


def _issue_otp(db: Session, email: str, purpose: str) -> str:
    """Invalidate any earlier unused code for this email and store a new one (caller commits)."""
    otp = generate_otp()
    expires_at = utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db.query(OTPCode).filter(OTPCode.email == email).delete()
    db.add(OTPCode(email=email, code_hash=hash_otp(otp), expires_at=expires_at, purpose=purpose))
    return otp


def _consume_otp(db: Session, email: str, otp: str, purpose: str) -> None:
    """Check a code; it works once, only for its purpose, and dies after too many wrong guesses."""
    record = (
        db.query(OTPCode)
        .filter(OTPCode.email == email, OTPCode.purpose == purpose)
        .order_by(OTPCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < utcnow():
        raise HTTPException(status_code=400, detail="Code expired, request a new one")
    if record.attempts >= settings.OTP_MAX_ATTEMPTS:
        raise HTTPException(status_code=400, detail="Too many wrong codes. Request a new one.")
    if not verify_otp(otp.strip(), record.code_hash):
        record.attempts += 1
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect code")
    db.delete(record)


def _login_response(user: User, response: Response) -> dict:
    """Start (or renew) a session: HttpOnly cookie, user in the body, no token for scripts."""
    set_session_cookie(response, create_access_token(user.id))
    return {"user": user}


def _find_user(db: Session, email: str) -> User | None:
    return db.query(User).filter(func.lower(User.email) == email.lower()).first()


INVALID_LOGIN = "Invalid email or password"
LOCKED_MESSAGE = "Too many failed attempts. Try again in a few minutes, or use Forgot password."
_login_ip_limiter = SlidingWindowLimiter(settings.LOGIN_IP_LIMIT, settings.LOGIN_IP_WINDOW_MINUTES * 60)
_login_edge_limiter = SlidingWindowLimiter(settings.LOGIN_EDGE_LIMIT, settings.LOGIN_IP_WINDOW_MINUTES * 60)
# Stops email bombing and protects the Brevo quota (each code is one email).
_code_email_limiter = SlidingWindowLimiter(1, settings.CODE_EMAIL_COOLDOWN_SECONDS)
_code_ip_limiter = SlidingWindowLimiter(settings.CODE_IP_LIMIT, settings.CODE_IP_WINDOW_MINUTES * 60)
_code_edge_limiter = SlidingWindowLimiter(settings.CODE_EDGE_LIMIT, settings.CODE_IP_WINDOW_MINUTES * 60)
CODE_TOO_SOON = "Please wait a minute before asking for another code."
# Unknown emails "lock" after the same number of failures as real accounts, so a lockout
# message doesn't reveal that an account exists.
_unknown_email_failures = SlidingWindowLimiter(settings.LOGIN_MAX_FAILURES - 1, settings.LOGIN_LOCK_MINUTES * 60)


def _send_quietly(send, *args) -> None:
    """Background email: failures are logged (the user just asks for another code)."""
    try:
        send(*args)
    except EmailError as e:
        logging.getLogger("campusmarket.email").error("Background email failed: %s", e)


def _ip_allowed(request: Request, edge_limiter: SlidingWindowLimiter, ip_limiter: SlidingWindowLimiter) -> bool:
    """Per-IP limits, on both the address that reached Render and the student's own (see client_ips)."""
    edge, reported = client_ips(request, settings.PROXY_HOPS)
    if edge_limiter.allow(edge) and ip_limiter.allow(reported):
        return True
    # Logged so you can check in Render's logs that these are the addresses you expect.
    logging.getLogger("campusmarket.ratelimit").warning("Rate limit hit on %s: edge=%s reported=%s", request.url.path, edge, reported)
    return False


def _may_send_code(request: Request, email: str) -> bool:
    return _ip_allowed(request, _code_edge_limiter, _code_ip_limiter) and _code_email_limiter.allow(email.lower())


# ---------- signup (code proves the college email; account + password created after) ----------


@router.post("/auth/signup")
def signup(payload: SignupRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Step 1: email a code. Same answer whether or not the email already has an account
    (an existing account gets a "you already have an account" email instead of a code), and
    the email goes out after the response, so timing gives nothing away either."""
    _check_domain(payload.email)
    _check_not_banned(db, payload.email)
    if not _may_send_code(request, payload.email):
        raise HTTPException(status_code=429, detail=CODE_TOO_SOON)
    existing = _find_user(db, payload.email)
    if existing and existing.verified:
        background.add_task(_send_quietly, send_account_exists_email, payload.email)
    else:
        otp = _issue_otp(db, payload.email, "signup")
        db.commit()
        background.add_task(_send_quietly, send_otp_email, payload.email, otp)
    return {"message": "Check your inbox for a 6-digit code."}


@router.post("/auth/signup/verify", response_model=LoginResponse)
def signup_verify(payload: SignupVerifyRequest, response: Response, db: Session = Depends(get_db)):
    """Step 2: check the code, then create the verified account with its password."""
    _check_domain(payload.email)
    _check_not_banned(db, payload.email)
    existing = _find_user(db, payload.email)
    if existing and existing.verified:
        # No signup code is ever sent to an existing account, so answer like a bad code.
        raise HTTPException(status_code=400, detail="Code expired, request a new one")
    _consume_otp(db, payload.email, payload.otp, "signup")

    # A row may exist from the old flow (signup started, never verified); finish it.
    user = existing or User(email=payload.email)
    if not existing:
        db.add(user)
    user.account_type = payload.account_type
    user.verified = True
    user.password_hash = hash_password(payload.password)
    user.password_changed_at = utcnow()  # logs out every older session
    db.commit()
    db.refresh(user)
    return _login_response(user, response)


# ---------- login ----------


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: PasswordLoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """Email + password. Unknown email, wrong password and "no password yet" all get the same
    answer, and lock out the same way, so this can't be used to find out who has an account.
    (Accounts from before passwords use Forgot password to set their first one.)"""
    if not _ip_allowed(request, _login_edge_limiter, _login_ip_limiter):
        raise HTTPException(status_code=429, detail="Too many login attempts. Wait a few minutes and try again.")

    user = _find_user(db, payload.email)
    now = utcnow()
    if not user or not user.verified:
        verify_password(payload.password, None)  # same work as a real check, so timing gives nothing away
        if not _unknown_email_failures.allow(payload.email.lower()):
            raise HTTPException(status_code=429, detail=LOCKED_MESSAGE)
        raise HTTPException(status_code=401, detail=INVALID_LOGIN)
    if user.locked_until and user.locked_until > now:
        raise HTTPException(status_code=429, detail=LOCKED_MESSAGE)
    if not verify_password(payload.password, user.password_hash):  # also False when no password is set
        user.failed_logins = (user.failed_logins or 0) + 1
        locked = user.failed_logins >= settings.LOGIN_MAX_FAILURES
        if locked:
            user.locked_until = now + timedelta(minutes=settings.LOGIN_LOCK_MINUTES)
            user.failed_logins = 0
        db.commit()
        raise HTTPException(status_code=429 if locked else 401, detail=LOCKED_MESSAGE if locked else INVALID_LOGIN)

    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    # Only told after the right password, so this can't be used to probe accounts.
    if user.suspended_at:
        raise HTTPException(status_code=403, detail=SUSPENDED_MESSAGE)
    db.refresh(user)
    return _login_response(user, response)


# ---------- Continue with Google ----------


@router.post("/auth/google", response_model=GoogleLoginResponse)
def google_sign_in(payload: GoogleSignInRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    """One tap: Google proves the student owns their college email, so no code step. Signs up a
    new account (with the chosen buyer/seller type) or logs into the existing one for that email."""
    if not _ip_allowed(request, _login_edge_limiter, _login_ip_limiter):
        raise HTTPException(status_code=429, detail="Too many login attempts. Wait a few minutes and try again.")
    try:
        claims = verify_google_token(payload.credential)
    except GoogleTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))

    email = claims["email"].lower()
    is_owner = email in {e.lower() for e in settings.OWNER_EMAILS}
    domain = email.split("@")[-1]
    # Must be a college Google Workspace account (Google's "hd" claim), apart from owners.
    if not is_owner and (domain not in settings.ALLOWED_EMAIL_DOMAINS or claims.get("hd") != domain):
        raise HTTPException(status_code=403, detail=f"Use your college Google account ({_allowed_domains_text()})")
    _check_not_banned(db, email)

    user = db.query(User).filter(User.google_sub == claims["sub"]).first() or _find_user(db, email)
    created = user is None
    if created:
        if not payload.account_type:
            raise HTTPException(status_code=400, detail="No account for this email yet. Sign up first and choose Buyer or Seller.")
        user = User(email=email, account_type=payload.account_type, name=claims.get("name"))
        db.add(user)
    elif user.google_sub and user.google_sub != claims["sub"]:
        raise HTTPException(status_code=409, detail="This email is linked to a different Google account")
    if user.suspended_at:
        raise HTTPException(status_code=403, detail=SUSPENDED_MESSAGE)
    user.google_sub = claims["sub"]
    user.verified = True  # Google verified the email
    if not user.name and claims.get("name"):
        user.name = claims["name"][:80]
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
    set_session_cookie(response, create_access_token(user.id))
    return {"user": user, "created": created}


# ---------- passwords ----------


@router.post("/auth/set-password", response_model=LoginResponse)
def set_password(
    payload: SetPasswordRequest,
    response: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user_any),
):
    """First password for an account that doesn't have one. Changing an existing password
    goes through Forgot password (which proves the email again)."""
    if user.password_hash:
        raise HTTPException(status_code=409, detail="You already have a password. Use Forgot password to change it.")
    user.password_hash = hash_password(payload.password)
    user.password_changed_at = utcnow()  # logs out every older session
    db.commit()
    db.refresh(user)
    # The change logs out older sessions, including this one, so hand back a fresh one.
    return _login_response(user, response)


@router.post("/auth/password/forgot")
def forgot_password(payload: ForgotPasswordRequest, request: Request, background: BackgroundTasks, db: Session = Depends(get_db)):
    """Email a reset code. Same answer whether or not the account exists (and when rate-limited,
    so the limit can't be used to find out which emails have accounts)."""
    _check_domain(payload.email)
    user = _find_user(db, payload.email)
    if user and user.verified and not user.suspended_at and _may_send_code(request, payload.email):
        otp = _issue_otp(db, payload.email, "reset")
        db.commit()
        # After the response, so answering for a real account takes no longer than for a fake one.
        background.add_task(_send_quietly, send_otp_email, payload.email, otp, "reset")
    return {"message": "If an account exists for this email, we've sent it a code."}


@router.post("/auth/password/reset", response_model=LoginResponse)
def reset_password(payload: ResetPasswordRequest, response: Response, db: Session = Depends(get_db)):
    """Check the reset code, set the new password, unlock the account and log in."""
    _consume_otp(db, payload.email, payload.otp, "reset")
    user = _find_user(db, payload.email)
    if not user or not user.verified:
        raise HTTPException(status_code=400, detail="Code expired, request a new one")
    if user.suspended_at:
        raise HTTPException(status_code=403, detail=SUSPENDED_MESSAGE)
    user.password_hash = hash_password(payload.password)
    user.password_changed_at = utcnow()  # logs out every older session
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    db.refresh(user)
    return _login_response(user, response)


@router.post("/auth/profile", response_model=UserOut)
def complete_profile(
    payload: ProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.name = payload.name
    user.college = payload.college
    user.course = payload.course
    user.year = payload.year
    user.phone = payload.phone
    user.profile_completed = True
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/interests", response_model=UserOut)
def save_interests(
    payload: InterestsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.interests = payload.interests
    db.commit()
    db.refresh(user)
    return user


@router.post("/auth/account-type", response_model=UserOut)
def set_account_type(
    payload: AccountTypeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Buyers can upgrade to seller. Going back is blocked so a seller's
    # existing listings never end up owned by an account that can't manage them.
    if user.account_type == "seller" and payload.account_type == "buyer":
        raise HTTPException(status_code=400, detail="Seller accounts can't switch back to buyer")
    user.account_type = payload.account_type
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/me/avatar", response_model=UserOut)
def upload_avatar(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        data = read_upload(file.file, MAX_AVATAR_BYTES)
        content_type, ext = check_image(data)  # by the actual bytes, not the file name or browser's label
    except ImageError as e:
        raise HTTPException(status_code=400, detail=str(e).replace("Images must", "Profile picture must"))

    key = f"avatars/{uuid.uuid4().hex}{ext}"
    storage.put_public(key, data, content_type)

    old = user.avatar_url
    user.avatar_url = storage.public_url(key, str(request.base_url))
    db.commit()
    db.refresh(user)
    if old:
        _delete_upload_files([old])
    return user


@router.delete("/users/me/avatar", response_model=UserOut)
def remove_avatar(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    old = user.avatar_url
    user.avatar_url = None
    db.commit()
    db.refresh(user)
    if old:
        _delete_upload_files([old])
    return user


@router.post("/users/me/views", status_code=204)
def record_views(
    payload: ViewsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Append opened listings/resources to the user's history (used for recommendations),
    so it follows them across devices. Keeps the most recent VIEW_HISTORY_MAX entries."""
    now = time.time() * 1000
    added = [{"kind": v.kind, "key": v.key, "ts": now} for v in payload.views]
    # Assign a new list so SQLAlchemy notices the JSON column changed.
    user.view_history = [*(user.view_history or []), *added][-VIEW_HISTORY_MAX:]
    db.commit()


@router.post("/auth/refresh", response_model=LoginResponse)
def refresh_session(response: Response, user: User = Depends(get_current_user_any)):
    """Swap a still-valid session for a fresh 30-day one. The app calls this on start-up, so
    regular users never get logged out. Old sessions killed by a password change can't renew.
    Also moves sessions that older versions of the app kept in the browser into the cookie."""
    return _login_response(user, response)


@router.post("/auth/logout", status_code=204)
def logout(response: Response):
    clear_session_cookie(response)


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user_any)):  # allowed before a password exists, so the app can ask for one
    return user
