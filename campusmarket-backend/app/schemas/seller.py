from datetime import datetime

from pydantic import BaseModel

from app.schemas.listing import ListingOut
from app.schemas.resource import ResourceOut


class SellerProfileOut(BaseModel):
    """A student's public page (verified students only): who they are, how long they've been
    here and how many things they've sold, so buyers can judge who they're dealing with. No
    contact details; those still go through POST /api/contact."""
    id: str
    name: str
    avatar_url: str | None = None
    college: str | None = None
    joined_at: datetime | None = None
    sold_count: int = 0
    listings: list[ListingOut] = []  # for sale or reserved right now
    resources: list[ResourceOut] = []  # open right now
