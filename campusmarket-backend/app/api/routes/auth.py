from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
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
from app.db.session import get_db  # <-- point this at your existing db session dependency
from app.models.otp import OTPCode
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    ProfileRequest,
    SignupRequest,
    UserOut,
)

router = APIRouter(prefix="/api", tags=["auth"])


def _check_domain(email: str) -> None:
    domain = email.split("@")[-1].lower()
    if domain not in settings.ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(status_code=400, detail=f"{domain} is not a recognised campus email")


@router.post("/auth/signup")
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    _check_domain(payload.email)

    otp = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.OTP_EXPIRE_MINUTES)

    # Invalidate any earlier unused code for this email, then store the new one.
    db.query(OTPCode).filter(OTPCode.email == payload.email).delete()
    db.add(OTPCode(email=payload.email, code_hash=hash_otp(otp), expires_at=expires_at))

    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        db.add(User(email=payload.email))

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


@router.get("/users/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user
