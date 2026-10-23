"""The Seller Dashboard's Deleted tab: your own listings and resources deleted in the
last 24 hours. Restoring goes through POST /api/listings/{id}/restore and
POST /api/resources/{id}/restore."""

from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.listings import purge_deleted_listings
from app.api.routes.resources import purge_deleted_resources
from app.core.security import get_current_user
from app.core.trash import restore_cutoff, restore_until
from app.db.session import get_db
from app.models.listing import Listing
from app.models.resource import Resource
from app.models.user import User
from app.schemas.listing import CATEGORY_ART, DEFAULT_ART

router = APIRouter(prefix="/api/trash", tags=["trash"])

RESOURCE_ART = {"emoji": "📚", "bg": "#EEF0FF"}


class TrashItemOut(BaseModel):
    type: Literal["listing", "resource"]
    id: int
    title: str
    price: float
    image: str | None = None
    emoji: str
    bg: str
    deleted_at: datetime
    restore_until: datetime


def _utc(value: datetime) -> datetime:
    # Stored as naive UTC; send it with the zone so browsers read it right.
    return value.replace(tzinfo=timezone.utc)


@router.get("", response_model=list[TrashItemOut])
def list_trash(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    purge_deleted_listings(db)
    purge_deleted_resources(db)
    cutoff = restore_cutoff()
    items: list[TrashItemOut] = []
    for listing in db.query(Listing).filter(Listing.owner_id == user.id, Listing.deleted_at >= cutoff):
        art = CATEGORY_ART.get(listing.category, DEFAULT_ART)
        items.append(TrashItemOut(
            type="listing", id=listing.id, title=listing.title, price=listing.price,
            image=(listing.images or [None])[0], emoji=art["emoji"], bg=art["bg"],
            deleted_at=_utc(listing.deleted_at), restore_until=_utc(restore_until(listing.deleted_at)),
        ))
    for r in db.query(Resource).filter(Resource.owner_id == user.id, Resource.deleted_at >= cutoff):
        items.append(TrashItemOut(
            type="resource", id=r.id, title=r.title, price=r.price, **RESOURCE_ART,
            deleted_at=_utc(r.deleted_at), restore_until=_utc(restore_until(r.deleted_at)),
        ))
    items.sort(key=lambda i: i.deleted_at, reverse=True)
    return items
