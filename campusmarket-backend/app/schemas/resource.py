import re
from datetime import datetime
from typing import Literal, Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator, model_validator

YEARS = ("1", "2", "3", "4", "any")

# Standard subjects: always offered in the filter and the form's suggestions, in this order.
# Other subjects can still be typed; they appear in the filter once a resource uses them.
SUBJECTS = (
    "Maths for AI/ML",
    "GenAI",
    "GoLang",
    "Data Science",
    "Full Stack Web Development",
    "DBMS",
    "Frontend Development",
    "DSA",
    "Machine Learning",
)
_SUBJECTS_BY_LOWER = {s.lower(): s for s in SUBJECTS}
DESCRIPTION_MAX = 500
NOTE_MAX = 200

# Hosts a drive link may point at. Subdomains count (e.g. contoso.sharepoint.com, www.dropbox.com).
DRIVE_HOSTS = (
    "drive.google.com",
    "docs.google.com",
    "onedrive.live.com",
    "1drv.ms",
    "sharepoint.com",
    "dropbox.com",
    "mega.nz",
    "mega.io",
)
UPI_RE = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$")


def _clean(value: str | None) -> str | None:
    value = " ".join((value or "").split())
    return value or None


def is_allowed_drive_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        return False
    return any(host == d or host.endswith("." + d) for d in DRIVE_HOSTS)


class ResourceIn(BaseModel):
    """Form fields for create / update. File rules are checked in the route, which knows the stored file."""

    title: str = Field(max_length=120)
    subject: str = Field(max_length=60)
    year: Literal["1", "2", "3", "4", "any"] = "any"
    copy_type: Literal["soft", "hard"]
    offer_type: Literal["sale", "free"]
    price: int = 0
    description: Optional[str] = Field(default=None, max_length=DESCRIPTION_MAX)
    delivery: Optional[Literal["pdf", "drive"]] = None
    drive_url: Optional[str] = Field(default=None, max_length=500)
    pickup_spot: Optional[str] = Field(default=None, max_length=120)
    upi_id: Optional[str] = Field(default=None, max_length=100)

    @field_validator("title", "subject")
    @classmethod
    def required_text(cls, value: str) -> str:
        value = _clean(value)
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("subject")
    @classmethod
    def canonical_subject(cls, value: str) -> str:
        # "dsa" -> "DSA", so the filter doesn't split one subject into several spellings.
        return _SUBJECTS_BY_LOWER.get(value.lower(), value)

    @field_validator("pickup_spot", "upi_id", "drive_url")
    @classmethod
    def strip_optional(cls, value: str | None) -> str | None:
        return _clean(value)

    @field_validator("description")
    @classmethod
    def keep_paragraphs(cls, value: str | None) -> str | None:
        value = (value or "").strip()
        return value or None

    @field_validator("price", mode="before")
    @classmethod
    def whole_rupees(cls, value):
        if value is None or value == "":
            return 0
        if isinstance(value, str):
            if not re.fullmatch(r"\d+", value.strip()):
                raise ValueError("Price must be a whole number of rupees")
            return int(value.strip())
        if isinstance(value, float) and not value.is_integer():
            raise ValueError("Price must be a whole number of rupees")
        return value

    @field_validator("upi_id")
    @classmethod
    def valid_upi(cls, value: str | None) -> str | None:
        if value and not UPI_RE.match(value):
            raise ValueError("Enter a UPI ID like name@okbank")
        return value

    @model_validator(mode="after")
    def offer_and_delivery_rules(self):
        if self.offer_type == "sale":
            if self.price < 1:
                raise ValueError("A sale needs a price of at least ₹1")
            if self.price > 100000:
                raise ValueError("Price looks too high")
        else:
            self.price = 0

        if self.copy_type == "soft":
            if not self.delivery:
                raise ValueError("Choose how the soft copy is delivered: PDF upload or drive link")
            self.pickup_spot = None
            if self.delivery == "drive":
                if not self.drive_url:
                    raise ValueError("Add the drive link")
                if not is_allowed_drive_url(self.drive_url):
                    raise ValueError(
                        "Drive links must be https and on Google Drive/Docs, OneDrive, SharePoint, Dropbox or Mega"
                    )
            else:
                self.drive_url = None
        else:
            if not self.pickup_spot:
                raise ValueError("Hard copies need a pickup spot")
            self.delivery = None
            self.drive_url = None
        return self


class StatusUpdate(BaseModel):
    status: Literal["available", "closed"]


class AccessRequestIn(BaseModel):
    note: Optional[str] = Field(default=None, max_length=NOTE_MAX)

    @field_validator("note")
    @classmethod
    def one_line(cls, value: str | None) -> str | None:
        return _clean(value)


class AccessDecision(BaseModel):
    status: Literal["approved", "denied"]


class OwnerOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    verified: bool
    campus: str | None = None
    # Only sent to logged-in, verified viewers.
    phone: str | None = None
    email: str | None = None


class PreviewPage(BaseModel):
    url: str
    kind: Literal["sharp", "blurred", "partial"]


class AccessRequestOut(BaseModel):
    id: int
    status: str
    note: str | None = None
    created_at: datetime
    updated_at: datetime
    decided_at: datetime | None = None
    requester: OwnerOut | None = None  # filled in for the owner's request list


class AccessOut(BaseModel):
    full: bool
    # owner | admin | free | granted | guest | unverified | locked | closed
    reason: str
    can_request: bool = False
    request: AccessRequestOut | None = None


class ResourceOut(BaseModel):
    id: int
    title: str
    subject: str
    year: str
    copy_type: str
    offer_type: str
    price: int
    description: str | None = None
    status: str
    delivery: str | None = None
    pickup_spot: str | None = None
    has_file: bool
    page_count: int | None = None
    preview_pages: list[PreviewPage] = []
    thumbnail_url: str | None = None
    created_at: datetime
    updated_at: datetime
    owner: OwnerOut

    # Detail view only. drive_url / file_url are present only with full access,
    # upi_id only for logged-in verified viewers.
    access: AccessOut | None = None
    drive_url: str | None = None
    file_url: str | None = None
    upi_id: str | None = None
    pending_requests: int | None = None  # owner only


class ResourceListOut(BaseModel):
    items: list[ResourceOut]
    total: int


class ResourceRecommendedOut(BaseModel):
    items: list[ResourceOut]
    personalized: bool


class FacetsOut(BaseModel):
    subjects: list[str]
