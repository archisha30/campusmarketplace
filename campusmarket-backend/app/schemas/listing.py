from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

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
    phone: str | None = None  # shared so buyers can WhatsApp the seller
    email: str | None = None  # shared so buyers can email the seller

    class Config:
        from_attributes = True


class ListingCreate(BaseModel):
    title: str = Field(min_length=1)
    category: str
    listing_type: Literal["sale", "rent", "free"] = "sale"
    price: float = 0
    condition: str
    description: Optional[str] = None
    pickup_spot: str = Field(min_length=1)
    food_temp: Optional[Literal["hot", "cold"]] = None  # F&B only, required there
    expiry_date: Optional[date] = None  # F&B only, optional


class ListingUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    listing_type: Optional[Literal["sale", "rent", "free"]] = None
    price: Optional[float] = None
    condition: Optional[str] = None
    description: Optional[str] = None
    pickup_spot: Optional[str] = None
    food_temp: Optional[Literal["hot", "cold"]] = None
    expiry_date: Optional[date] = None
    # URLs of photos to KEEP. Any current photo not listed here is removed.
    images: Optional[list[str]] = None


class StatusUpdate(BaseModel):
    status: Literal["available", "reserved", "sold"]


class ListingOut(BaseModel):
    id: int
    title: str
    category: str
    listing_type: str
    price: float
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
    def from_orm_with_art(cls, listing):
        art = CATEGORY_ART.get(listing.category, DEFAULT_ART)
        return cls(
            id=listing.id,
            title=listing.title,
            category=listing.category,
            listing_type=listing.listing_type,
            price=listing.price,
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
                phone=listing.owner.phone,
                email=listing.owner.email,
            ),
            art=Art(**art),
        )


class ListingListOut(BaseModel):
    items: list[ListingOut]
    total: int


class RecommendedOut(BaseModel):
    items: list[ListingOut]
    personalized: bool
