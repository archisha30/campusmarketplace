import uuid
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.email import send_otp_email
from app.core.security import (
    create_access_token,
    generate_otp,
    get_current_user,
    hash_otp,
    verify_otp,
)
from app.api.routes.listings import _delete_upload_files
from app.core.storage import storage
from app.db.session import get_db  # <-- point this at your existing db session dependency
from app.models.otp import OTPCode
from app.models.user import User
from app.schemas.auth import (
    AccountTypeRequest,
    InterestsRequest,
    LoginCodeRequest,
    LoginRequest,
    LoginResponse,
    ProfileRequest,
    ProfileUpdateRequest,
    SignupRequest,
    UserOut,
)

router = APIRouter(prefix="/api", tags=["auth"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
AVATAR_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def _check_domain(email: str) -> None:
    domain = email.split("@")[-1].lower()
    if domain not in settings.ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f"{domain} is not a recognised campus email")


def _issue_otp(db: Session, email: str) -> str:
    """Invalidate any earlier unused code for this email and store a new one (caller commits)."""
    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)
    db.query(OTPCode).filter(OTPCode.email == email).delete()
    db.add(OTPCode(email=email, code_hash=hash_otp(otp), expires_at=expires_at))
    return otp


@router.post("/auth/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    _check_domain(payload.email)
    otp = _issue_otp(db, payload.email)

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        db.add(User(email=payload.email, account_type=payload.account_type))
    elif not user.verified:
        # Signup was never finished, so the latest choice wins.
        user.account_type = payload.account_type

    db.commit()
    send_otp_email(payload.email, otp)
    return {"message": "OTP sent"}


@router.post("/auth/login-code")
def login_code(payload: LoginCodeRequest, db: Session = Depends(get_db)):
    """Send a login code to an EXISTING account. Never creates one or changes its buyer/seller
    type, so new students always go through signup, where they choose."""
    _check_domain(payload.email)
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account with this email yet. Sign up first.")
    otp = _issue_otp(db, payload.email)
    db.commit()
    send_otp_email(payload.email, otp)
    return {"message": "OTP sent"}


@router.post("/auth/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    record = (
        db.query(OTPCode)
        .filter(OTPCode.email == payload.email)
        .order_by(OTPCode.created_at.desc())
        .first()
    )
    if not record or record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Code expired, request a new one")
    if not verify_otp(payload.otp, record.code_hash):
        raise HTTPException(status_code=400, detail="Incorrect code")

    user = db.query(User).filter(User.email == payload.email).first()
    user.verified = True
    db.delete(record)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return {"token": token, "user": user}


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
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="Profile picture must be an image")
    ext = Path(file.filename or "").suffix.lower() or ".jpg"
    if ext not in AVATAR_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Use a JPG, PNG, WEBP or GIF image")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="Profile picture must be under 5 MB")

    key = f"avatars/{uuid.uuid4().hex}{ext}"
    storage.put_public(key, file.file.read(), file.content_type)

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


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
