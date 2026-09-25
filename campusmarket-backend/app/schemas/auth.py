import uuid
from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    otp: str


class ProfileRequest(BaseModel):
    name: str
    college: str
    course: str
    year: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None = None
    college: str | None = None
    course: str | None = None
    year: str | None = None
    role: str
    verified: bool
    profile_completed: bool

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    token: str
    user: UserOut
