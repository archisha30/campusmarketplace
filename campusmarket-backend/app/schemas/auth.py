import re
import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, field_validator

from app.schemas.listing import CATEGORY_ART

# Buyers can only buy; sellers can buy and sell.
AccountType = Literal["buyer", "seller"]


class SignupRequest(BaseModel):
    email: EmailStr
    account_type: AccountType = "buyer"


class LoginCodeRequest(BaseModel):
    email: EmailStr


class AccountTypeRequest(BaseModel):
    account_type: AccountType


class LoginRequest(BaseModel):
    email: EmailStr
    otp: str


class ProfileRequest(BaseModel):
    name: str
    college: str
    course: str
    year: str


def normalize_phone(value: str | None) -> str | None:
    """Accepts '7008699207', '+91 70086 99207', '091-7008699207' etc.
    Returns digits with the 91 country code, or None when left blank."""
    if value is None or not value.strip():
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) == 10:
        digits = "91" + digits
    if not (len(digits) == 12 and digits.startswith("91") and digits[2] in "6789"):
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


class ProfileUpdateRequest(BaseModel):
    # Every field is optional; only the ones sent are changed.
    name: str | None = None
    college: str | None = None
    course: str | None = None
    year: str | None = None
    phone: str | None = None

    @field_validator("name", "college")
    @classmethod
    def not_blank(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            raise ValueError("This field can't be empty")
        return value.strip()

    @field_validator("course", "year")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        return normalize_phone(value)


class InterestsRequest(BaseModel):
    interests: list[str]

    @field_validator("interests")
    @classmethod
    def only_known_categories(cls, value: list[str]) -> list[str]:
        unknown = [c for c in value if c not in CATEGORY_ART]
        if unknown:
            raise ValueError(f"Unknown categories: {', '.join(unknown)}")
        return list(dict.fromkeys(value))  # drop duplicates, keep order


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None = None
    college: str | None = None
    course: str | None = None
    year: str | None = None
    role: str
    account_type: str = "buyer"
    avatar_url: str | None = None
    phone: str | None = None
    verified: bool
    profile_completed: bool
    interests: list[str] = []

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: UserOut
