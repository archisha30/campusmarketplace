from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

CATEGORY_ART = {
    "Textbooks": {"emoji": "📘", "bg": "#F1EAFF"},
    "Lab Gear": {"emoji": "📐", "bg": "#EAF0FF"},
    "Electronics": {"emoji": "🔌", "bg": "#EAFBF0"},
    "Dorm Essentials": {"emoji": "🛏️", "bg": "#FFECEA"},
    "Project Kits": {"emoji": "🧰", "bg": "#FFF3D6"},
    "Sports": {"emoji": "🏸", "bg": "#FFF0F5"},
    "Clothing & Event Wear": {"emoji": "🧥", "bg": "#FFF6E0"},
    "F&B": {"emoji": "🍱", "bg": "#FFF1E0"},
}
FOOD_CATEGORY = "F&B"
DEFAULT_ART = {"emoji": "📦", "bg": "#EFEFEC"}


class Art(BaseModel):
    emoji: str
    bg: str


class SellerOut(BaseModel):
    id: str
    name: str | None = None
    campus_id: int = 1
    campus: str | None = None
    verified: bool
    avatar_url: str | None = None
    # Phone and email are NOT included for students (they'd be easy to scrape from lists):
    # Contact Seller asks POST /api/contact for one seller at a time. Admin views include them.
    has_phone: bool = False
    phone: str | None = None
    email: str | None = None

    class Config:
        from_attributes = True


MAX_PRICE = 1_000_000


def _known_category(value: str | None) -> str | None:
    if value is not None and value not in CATEGORY_ART:
        raise ValueError("Pick one of the listed categories")
    return value


def _needs_description(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Add a description so buyers know what they're getting")
    return value


class ListingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    category: str
    listing_type: Literal["sale", "rent", "free"] = "sale"
    price: float = Field(default=0, ge=0, le=MAX_PRICE)
    mrp: Optional[float] = Field(default=None, gt=0, le=MAX_PRICE)  # sale only
    condition: str = Field(max_length=30)
    description: str = Field(max_length=2000)
    pickup_spot: str = Field(min_length=1, max_length=120)
    food_temp: Optional[Literal["hot", "cold"]] = None  # F&B only, required there
    expiry_date: Optional[date] = None  # F&B only, optional

    _category = field_validator("category")(classmethod(lambda cls, v: _known_category(v)))
    _description = field_validator("description")(classmethod(lambda cls, v: _needs_description(v)))


class ListingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    category: Optional[str] = None
    listing_type: Optional[Literal["sale", "rent", "free"]] = None
    price: Optional[float] = Field(default=None, ge=0, le=MAX_PRICE)
    mrp: Optional[float] = Field(default=None, gt=0, le=MAX_PRICE)
    condition: Optional[str] = Field(default=None, max_length=30)
    description: Optional[str] = Field(default=None, max_length=2000)
    pickup_spot: Optional[str] = Field(default=None, min_length=1, max_length=120)
    food_temp: Optional[Literal["hot", "cold"]] = None
    expiry_date: Optional[date] = None
    # URLs of photos to KEEP. Any current photo not listed here is removed.
    images: Optional[list[str]] = None

    _category = field_validator("category")(classmethod(lambda cls, v: _known_category(v)))
    _description = field_validator("description")(classmethod(lambda cls, v: v if v is None else _needs_description(v)))


class StatusUpdate(BaseModel):
    status: Literal["available", "reserved", "sold"]


class ListingOut(BaseModel):
    id: int
    title: str
    category: str
    listing_type: str
    price: float
    mrp: float | None = None
    condition: str
    description: str | None = None
    pickup_spot: str
    status: str
    campus_id: int
    images: list[str] = []
    food_temp: str | None = None
    expiry_date: date | None = None
    is_expired: bool = False
    created_at: datetime
    seller: SellerOut
    art: Art

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_art(cls, listing, include_contact: bool = False):
        art = CATEGORY_ART.get(listing.category, DEFAULT_ART)
        return cls(
            id=listing.id,
            title=listing.title,
            category=listing.category,
            listing_type=listing.listing_type,
            price=listing.price,
            mrp=listing.mrp,
            condition=listing.condition,
            description=listing.description,
            pickup_spot=listing.pickup_spot,
            status=listing.status,
            campus_id=listing.campus_id,
            images=listing.images or [],
            food_temp=listing.food_temp,
            expiry_date=listing.expiry_date,
            is_expired=bool(listing.expiry_date and listing.expiry_date < date.today()),
            created_at=listing.created_at,
            seller=SellerOut(
                id=str(listing.owner.id),
                name=listing.owner.name or listing.owner.email.split("@")[0],
                campus_id=1,
                campus=listing.owner.college,
                verified=listing.owner.verified,
                avatar_url=listing.owner.avatar_url,
                has_phone=bool(listing.owner.phone),
                phone=listing.owner.phone if include_contact else None,
                email=listing.owner.email if include_contact else None,
            ),
            art=Art(**art),
        )


class ListingListOut(BaseModel):
    items: list[ListingOut]
    total: int  # all matching listings, not just this page
    page: int | None = None  # set when the request asked for a page
    page_size: int | None = None
    pages: int | None = None


class RecommendedOut(BaseModel):
    items: list[ListingOut]
    personalized: bool
