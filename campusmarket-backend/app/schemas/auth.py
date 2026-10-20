import re
import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.listing import CATEGORY_ART

# Buyers can only buy; sellers can buy and sell.
AccountType = Literal["buyer", "seller"]


class SignupRequest(BaseModel):
    email: EmailStr
    account_type: AccountType = "buyer"


class AccountTypeRequest(BaseModel):
    account_type: AccountType


# --- Passwords ---
# Same rules as src/lib/password.js: 8+ characters with at least one letter and one number.
PASSWORD_MIN = 8
PASSWORD_MAX = 128


def check_password_rules(password: str) -> str:
    if len(password) < PASSWORD_MIN:
        raise ValueError(f"Password must be at least {PASSWORD_MIN} characters")
    if len(password) > PASSWORD_MAX:
        raise ValueError(f"Password must be at most {PASSWORD_MAX} characters")
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError("Password must include at least one letter and one number")
    return password


class NewPasswordMixin(BaseModel):
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def strong_enough(cls, value: str) -> str:
        return check_password_rules(value)

    @model_validator(mode="after")
    def passwords_match(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords don't match")
        return self


class SignupVerifyRequest(NewPasswordMixin):
    """Step 2 of signup: the emailed code proves the college email; only then is the
    account created with this password."""
    email: EmailStr
    otp: str
    account_type: AccountType = "buyer"


class GoogleSignInRequest(BaseModel):
    credential: str = Field(min_length=20, max_length=4096)  # Google's ID token
    account_type: AccountType = "buyer"  # only used when this creates a new account


class GoogleLoginResponse(BaseModel):
    user: "UserOut"
    created: bool  # True when this was a new signup (the app goes to onboarding)


class PasswordLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=PASSWORD_MAX)


class SetPasswordRequest(NewPasswordMixin):
    pass


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(NewPasswordMixin):
    email: EmailStr
    otp: str


SEMESTERS = tuple(f"Sem {n}" for n in range(1, 9))
Semester = Literal[SEMESTERS]  # type: ignore[valid-type]


class ProfileRequest(BaseModel):
    name: str = Field(max_length=80)
    college: str = Field(max_length=120)
    course: str = Field(max_length=60)
    year: Semester
    # WhatsApp number: buyers tap "Contact Seller" and land on the seller's own chat.
    phone: str

    @field_validator("phone")
    @classmethod
    def required_phone(cls, value: str) -> str:
        phone = normalize_phone(value)
        if not phone:
            raise ValueError("Enter your WhatsApp number")
        return phone


def normalize_phone(value: str | None) -> str | None:
    """Accepts '9876543210', '+91 98765 43210', '091-9876543210' etc.
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
    name: str | None = Field(default=None, max_length=80)
    college: str | None = Field(default=None, max_length=120)
    course: str | None = Field(default=None, max_length=60)
    year: Semester | None = None
    phone: str | None = Field(default=None, max_length=20)

    @field_validator("name", "college")
    @classmethod
    def not_blank(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            raise ValueError("This field can't be empty")
        return value.strip()

    @field_validator("course")
    @classmethod
    def strip(cls, value: str | None) -> str | None:
        return value.strip() if value else value

    @field_validator("phone")
    @classmethod
    def valid_phone(cls, value: str | None) -> str | None:
        # Can be changed but not removed: it's how buyers reach a seller.
        phone = normalize_phone(value)
        if value is not None and not phone:
            raise ValueError("Your WhatsApp number is required so buyers can contact you")
        return phone


class InterestsRequest(BaseModel):
    interests: list[str]

    @field_validator("interests")
    @classmethod
    def only_known_categories(cls, value: list[str]) -> list[str]:
        unknown = [c for c in value if c not in CATEGORY_ART]
        if unknown:
            raise ValueError(f"Unknown categories: {', '.join(unknown)}")
        return list(dict.fromkeys(value))  # drop duplicates, keep order


class ViewEntry(BaseModel):
    kind: Literal["listing", "resource"]
    key: str = Field(min_length=1, max_length=60)  # listing category or resource subject
    ts: float | None = None  # epoch ms; set by the server when recording


class ViewsRequest(BaseModel):
    views: list[ViewEntry] = Field(min_length=1, max_length=50)


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None = None
    college: str | None = None
    course: str | None = None
    year: str | None = None
    role: str
    is_admin: bool = False  # owners + approved admins (computed, see User.is_admin)
    is_owner: bool = False
    account_type: str = "buyer"
    avatar_url: str | None = None
    phone: str | None = None
    verified: bool
    profile_completed: bool
    has_password: bool = False  # never the hash itself
    uses_google: bool = False
    needs_password: bool = False  # old email-only accounts: the app shows "Create a password"
    interests: list[str] = []
    view_history: list[ViewEntry] = []

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    # The session itself is set as an HttpOnly cookie, never returned to page scripts.
    user: UserOut


GoogleLoginResponse.model_rebuild()
