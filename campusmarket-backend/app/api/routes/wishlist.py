"""The heart button: listings and Resource Hub items a student saved, kept on the server so the
wishlist is the same on every device. Deleted, held, or suspended owners' items drop out."""

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.core.security import require_verified
from app.core.trash import live
from app.db.session import get_db
from app.api.routes.resources import _resource_out
from app.models.listing import Listing
from app.models.resource import Resource
from app.models.resource_wishlist import ResourceWishlistItem
from app.models.user import User
from app.models.wishlist import WishlistItem
from app.schemas.listing import ListingOut
from app.schemas.resource import ResourceOut

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])

MAX_SAVED = 200


class ImportIn(BaseModel):
    # Listings saved in this browser before wishlists moved to the server.
    listing_ids: list[int] = Field(max_length=MAX_SAVED)


def _saved(db: Session, user: User) -> list[ListingOut]:
    rows = (
        db.query(Listing)
        .join(WishlistItem, WishlistItem.listing_id == Listing.id)
        .filter(WishlistItem.user_id == user.id, live(Listing))
        .order_by(WishlistItem.created_at.desc(), Listing.id.desc())
        .all()
    )
    return [ListingOut.from_orm_with_art(l) for l in rows]


def _add(db: Session, user: User, listing_ids: list[int]) -> None:
    have = {lid for (lid,) in db.query(WishlistItem.listing_id).filter(WishlistItem.user_id == user.id)}
    wanted = [lid for lid in dict.fromkeys(listing_ids) if lid not in have]
    if not wanted:
        return
    if len(have) + len(wanted) > MAX_SAVED:
        raise HTTPException(status_code=409, detail=f"Your wishlist is full ({MAX_SAVED} items). Remove a few first.")
    found = {lid for (lid,) in db.query(Listing.id).filter(Listing.id.in_(wanted), live(Listing))}
    for lid in wanted:
        if lid in found:
            db.add(WishlistItem(user_id=user.id, listing_id=lid))
    db.commit()


# ---------- Resource Hub items (declared before /{listing_id} so "resources" isn't read as an id) ----------

@router.get("/resources", response_model=list[ResourceOut])
def list_saved_resources(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    """Saved resources, most recently saved first (closed ones stay, marked closed)."""
    rows = (
        db.query(Resource)
        .options(joinedload(Resource.owner))
        .join(ResourceWishlistItem, ResourceWishlistItem.resource_id == Resource.id)
        .filter(ResourceWishlistItem.user_id == user.id, live(Resource))
        .order_by(ResourceWishlistItem.created_at.desc(), Resource.id.desc())
        .all()
    )
    return [_resource_out(r, request) for r in rows]


@router.put("/resources/{resource_id}", status_code=204)
def save_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    if not db.query(Resource.id).filter(Resource.id == resource_id, live(Resource)).first():
        raise HTTPException(status_code=404, detail="Resource not found")
    if db.get(ResourceWishlistItem, (user.id, resource_id)):
        return
    if db.query(ResourceWishlistItem).filter(ResourceWishlistItem.user_id == user.id).count() >= MAX_SAVED:
        raise HTTPException(status_code=409, detail=f"You can save up to {MAX_SAVED} resources. Remove a few first.")
    db.add(ResourceWishlistItem(user_id=user.id, resource_id=resource_id))
    db.commit()


@router.delete("/resources/{resource_id}", status_code=204)
def unsave_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    db.query(ResourceWishlistItem).filter(
        ResourceWishlistItem.user_id == user.id, ResourceWishlistItem.resource_id == resource_id
    ).delete(synchronize_session=False)
    db.commit()


# ---------- Listings ----------

@router.get("", response_model=list[ListingOut])
def list_wishlist(
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    """Saved listings, most recently saved first."""
    return _saved(db, user)


@router.put("/{listing_id}", status_code=204)
def save_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    if not db.query(Listing.id).filter(Listing.id == listing_id, live(Listing)).first():
        raise HTTPException(status_code=404, detail="Listing not found")
    _add(db, user, [listing_id])


@router.delete("/{listing_id}", status_code=204)
def unsave_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    db.query(WishlistItem).filter(
        WishlistItem.user_id == user.id, WishlistItem.listing_id == listing_id
    ).delete(synchronize_session=False)
    db.commit()


@router.post("/import", response_model=list[ListingOut])
def import_wishlist(
    payload: ImportIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    """One-time move of a browser's saved listings to the account. Unknown or deleted
    listings are skipped. Returns the whole wishlist."""
    _add(db, user, payload.listing_ids)
    return _saved(db, user)
