import json
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import require_seller, require_verified
from app.core.storage import delete_public_urls, storage
from app.db.session import get_db
from app.models.listing import Listing
from app.models.user import User
from app.schemas.listing import (
    FOOD_CATEGORY,
    ListingCreate,
    ListingListOut,
    ListingOut,
    ListingUpdate,
    RecommendedOut,
    StatusUpdate,
)

router = APIRouter(prefix="/api/listings", tags=["listings"])

UPLOAD_DIR = Path(__file__).resolve().parents[3] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


MAX_IMAGES = 3


def _delete_upload_files(urls: list[str]) -> None:
    """Best-effort removal of uploaded public files (Supabase or legacy local /uploads/ URLs)."""
    delete_public_urls(urls)


def _not_expired():
    """Listings without an expiry date, or whose expiry date hasn't passed yet."""
    return or_(Listing.expiry_date.is_(None), Listing.expiry_date >= date.today())


def _apply_food_rules(listing: Listing, check_expiry: bool) -> None:
    """F&B needs hot/cold, can't be rented, and has no wear-and-tear condition.
    Other categories never carry food fields."""
    if listing.category == FOOD_CATEGORY:
        if listing.food_temp not in ("hot", "cold"):
            raise HTTPException(status_code=422, detail="Choose whether the food is hot or cold")
        if listing.listing_type == "rent":
            raise HTTPException(status_code=422, detail="Food can be sold or given away, not rented")
        if check_expiry and listing.expiry_date and listing.expiry_date < date.today():
            raise HTTPException(status_code=422, detail="That expiry date has already passed")
        listing.condition = "Fresh"
    else:
        listing.food_temp = None
        listing.expiry_date = None


def _get_owned_listing(listing_id: int, db: Session, user: User) -> Listing:
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if listing.owner_id != user.id:
        raise HTTPException(status_code=403, detail="You don't own this listing")
    return listing


@router.get("", response_model=ListingListOut)
def list_listings(
    q: Optional[str] = None,
    category: Optional[str] = None,
    condition: Optional[str] = None,
    listing_type: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    status: Optional[str] = None,
    seller_id: Optional[str] = None,
    campus_id: Optional[int] = None,
    include_sold: bool = False,
    sort: str = "newest",
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),  # the marketplace is for verified students only
):
    query = db.query(Listing)

    if q:
        query = query.filter(Listing.title.ilike(f"%{q}%"))
    if category and category not in ("All", "any"):
        query = query.filter(Listing.category == category)
    if condition and condition not in ("All", "any"):
        query = query.filter(Listing.condition == condition)
    if listing_type and listing_type not in ("All", "any"):
        query = query.filter(Listing.listing_type == listing_type)
    if min_price is not None:
        query = query.filter(Listing.price >= min_price)
    if max_price is not None:
        query = query.filter(Listing.price <= max_price)
    if campus_id:
        query = query.filter(Listing.campus_id == campus_id)
    if seller_id:
        try:
            query = query.filter(Listing.owner_id == uuid.UUID(seller_id))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid seller id")
    if status:
        query = query.filter(Listing.status == status)
    elif not include_sold and not seller_id:
        query = query.filter(Listing.status != "sold")
    if not seller_id:
        query = query.filter(_not_expired())  # expired food leaves the marketplace; sellers still see it

    if sort == "price_low":
        query = query.order_by(Listing.price.asc())
    elif sort == "price_high":
        query = query.order_by(Listing.price.desc())
    else:
        query = query.order_by(Listing.created_at.desc())

    items = query.all()
    return ListingListOut(
        items=[ListingOut.from_orm_with_art(i) for i in items],
        total=len(items),
    )


@router.get("/recommended", response_model=RecommendedOut)
def recommended_listings(
    exclude_id: Optional[int] = None,
    campus_id: Optional[int] = None,
    category_scores: Optional[str] = None,  # JSON like {"Electronics": 2.0}, built by the frontend
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),
):
    """Content-based ranking: category affinity + mild same-campus boost + recency tiebreak."""
    scores: dict[str, float] = {}
    if category_scores:
        try:
            parsed = json.loads(category_scores)
            if isinstance(parsed, dict):
                scores = {str(k): float(v) for k, v in parsed.items()}
        except (ValueError, TypeError):
            scores = {}  # malformed input just means "no personalization"

    query = db.query(Listing).filter(Listing.status == "available", _not_expired())
    if exclude_id:
        query = query.filter(Listing.id != exclude_id)
    pool = query.order_by(Listing.created_at.desc()).all()

    def score(listing: Listing) -> float:
        s = scores.get(listing.category, 0.0)
        if campus_id and listing.campus_id == campus_id:
            s += 0.5
        return s

    # sorted() is stable, so equal scores keep the newest-first order from the query.
    ranked = sorted(pool, key=score, reverse=True)[:8]
    return RecommendedOut(
        items=[ListingOut.from_orm_with_art(i) for i in ranked],
        personalized=bool(scores),
    )


@router.get("/{listing_id}", response_model=ListingOut)
def get_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return ListingOut.from_orm_with_art(listing)


@router.post("", response_model=ListingOut)
def create_listing(
    payload: ListingCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    if not user.profile_completed:
        raise HTTPException(status_code=403, detail="Complete your profile before listing an item")
    if not user.phone:
        raise HTTPException(status_code=403, detail="Add your WhatsApp number in your profile so buyers can contact you")
    listing = Listing(**payload.model_dump(), owner_id=user.id)
    _apply_food_rules(listing, check_expiry=True)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)


@router.put("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    payload: ListingUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    listing = _get_owned_listing(listing_id, db, user)
    data = payload.model_dump(exclude_unset=True)

    keep = data.pop("images", None)
    removed: list[str] = []
    if keep is not None:
        current = listing.images or []
        kept = [u for u in current if u in keep]  # can only keep photos it already has
        removed = [u for u in current if u not in keep]
        listing.images = kept

    for key, value in data.items():
        setattr(listing, key, value)
    # Only re-check the expiry date when it's being changed, so an expired item can still be edited.
    _apply_food_rules(listing, check_expiry="expiry_date" in data)
    db.commit()
    _delete_upload_files(removed)
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)


@router.patch("/{listing_id}/status", response_model=ListingOut)
def set_listing_status(
    listing_id: int,
    payload: StatusUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    listing = _get_owned_listing(listing_id, db, user)
    listing.status = payload.status
    db.commit()
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)


@router.delete("/{listing_id}", status_code=204)
def delete_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    listing = _get_owned_listing(listing_id, db, user)
    db.delete(listing)
    db.commit()


@router.post("/{listing_id}/images", response_model=ListingOut)
def upload_images(
    listing_id: int,
    request: Request,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    listing = _get_owned_listing(listing_id, db, user)

    room = MAX_IMAGES - len(listing.images or [])
    if room <= 0:
        raise HTTPException(status_code=400, detail=f"A listing can have at most {MAX_IMAGES} photos")

    urls = []
    for f in files[:room]:
        if f.content_type and not f.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Only image files are allowed")
        ext = (Path(f.filename or "").suffix or ".jpg").lower()
        key = f"listings/{uuid.uuid4().hex}{ext}"
        storage.put_public(key, f.file.read(), f.content_type or "image/jpeg")
        urls.append(storage.public_url(key, str(request.base_url)))

    listing.images = [*(listing.images or []), *urls]
    db.commit()
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)
