from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.schemas.listing import ListingOut
from app.schemas.resource import ResourceOut

MAX_LEN = 70


class ProductRequestCreate(BaseModel):
    product: str = Field(max_length=MAX_LEN)
    description: str | None = Field(default=None, max_length=MAX_LEN)

    @field_validator("product")
    @classmethod
    def product_required(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Tell sellers what you're looking for")
        return value

    @field_validator("description")
    @classmethod
    def one_line(cls, value: str | None) -> str | None:
        # Collapse newlines/extra spaces so it stays a single line.
        value = " ".join((value or "").split())
        return value or None


class RequesterOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    has_phone: bool = False
    # Not included in the sellers' feed (it would be easy to scrape); replying goes through
    # POST /api/contact. Your own requests include them.
    email: str | None = None
    phone: str | None = None


class ProductRequestOut(BaseModel):
    id: int
    product: str
    description: str | None = None
    created_at: datetime
    requester: RequesterOut

    @classmethod
    def from_model(cls, r, include_contact: bool = False) -> "ProductRequestOut":
        return cls(
            id=r.id,
            product=r.product,
            description=r.description,
            created_at=r.created_at,
            requester=RequesterOut(
                id=str(r.user.id),
                name=r.user.name or r.user.email.split("@")[0],
                avatar_url=r.user.avatar_url,
                has_phone=bool(r.user.phone),
                email=r.user.email if include_contact else None,
                phone=r.user.phone if include_contact else None,
            ),
        )


class ProductRequestCreated(ProductRequestOut):
    # Listings and resources already up that match, so the student may not need to wait for a seller.
    matches: list[ListingOut] = []
    resource_matches: list[ResourceOut] = []
