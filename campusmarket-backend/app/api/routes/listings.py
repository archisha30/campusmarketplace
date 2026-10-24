import json
import uuid
from datetime import date
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlalchemy import case, or_
from sqlalchemy.orm import Session

from app.core.images import ImageError, check_image, read_upload
from app.core.pagination import paginate
from app.core.search import expand, relevance, search_filter, title_vocabulary
from app.core.security import require_seller, require_verified
from app.core.storage import delete_public_urls, storage
from app.core.trash import live, restore_cutoff
from app.core.timeutil import utcnow
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
VOCABULARY_TITLES = 5000  # recent listing titles whose words count as "known" when fixing typos
MAX_PHOTO_BYTES = 8 * 1024 * 1024  # the Sell page shrinks photos first, so this is generous


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


def _apply_mrp_rule(listing: Listing) -> None:
    """MRP only means something for a sale, and can't be below the selling price."""
    if listing.listing_type != "sale":
        listing.mrp = None
    elif listing.mrp is not None and listing.mrp < listing.price:
        raise HTTPException(status_code=422, detail="MRP can't be lower than the selling price")


async def _listing_body(request: Request) -> tuple[dict, list]:
    """The listing fields plus any new photos. Either plain JSON (no photos), or multipart
    with the fields as JSON in `data` and the photos in `files`, which is how the Sell page
    sends them, so a listing and its photos are saved together."""
    try:
        if request.headers.get("content-type", "").startswith(("multipart/form-data", "application/x-www-form-urlencoded")):
            form = await request.form()
            data = json.loads(form.get("data") or "{}")
            files = [f for f in form.getlist("files") if hasattr(f, "file")]
        else:
            data, files = await request.json(), []
    except ValueError:
        raise HTTPException(status_code=422, detail="Couldn't read the listing details. Refresh and try again.")
    if not isinstance(data, dict):
        raise HTTPException(status_code=422, detail="Couldn't read the listing details. Refresh and try again.")
    return data, files


def _parse(schema: type[BaseModel], data: dict):
    try:
        return schema.model_validate(data)
    except ValidationError as e:
        raise RequestValidationError(e.errors(include_url=False))  # the usual 422 shape


def _check_photos(files: list) -> list[tuple[bytes, str, str]]:
    """Check every photo before storing any, so one bad file doesn't leave half an upload behind."""
    checked = []
    for f in files:
        try:
            data = read_upload(f.file, MAX_PHOTO_BYTES)
            content_type, ext = check_image(data)
        except ImageError as e:
            raise HTTPException(status_code=400, detail=str(e))
        checked.append((data, content_type, ext))
    return checked


def _store_photos(checked: list[tuple[bytes, str, str]], request: Request) -> list[str]:
    urls = []
    for data, content_type, ext in checked:
        key = f"listings/{uuid.uuid4().hex}{ext}"
        storage.put_public(key, data, content_type)
        urls.append(storage.public_url(key, str(request.base_url)))
    return urls


def _commit_or_drop_photos(db: Session, urls: list[str]) -> None:
    try:
        db.commit()
    except Exception:
        db.rollback()
        _delete_upload_files(urls)
        raise


def _get_owned_listing(listing_id: int, db: Session, user: User) -> Listing:
    listing = db.query(Listing).filter(Listing.id == listing_id, live(Listing)).first()
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
    include_sold: bool = True,  # kept for older clients; sold listings are always included now
    sort: str = "newest",  # newest | price_low | price_high | relevance (best match, with q)
    page: Optional[int] = None,  # 1-based; omit to get everything (seller dashboard/profile)
    page_size: int = 24,
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),  # the marketplace is for verified students only
):
    query = db.query(Listing).filter(live(Listing))

    groups = []
    if q and q.strip():
        # Title, description and category; plurals, related words and typos (core/search.py).
        titles = (t for (t,) in db.query(Listing.title).filter(live(Listing)).order_by(Listing.created_at.desc()).limit(VOCABULARY_TITLES))
        groups = expand(q[:100], title_vocabulary(titles))
        query = query.filter(*search_filter(Listing, groups))
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
    # Sold listings stay visible (marked Sold on the card), listed after the ones still for sale.
    if not seller_id:
        query = query.filter(_not_expired())  # expired food leaves the marketplace; sellers still see it

    sold_last = case((Listing.status == "sold", 1), else_=0)
    if sort == "price_low":
        query = query.order_by(sold_last, Listing.price.asc())
    elif sort == "price_high":
        query = query.order_by(sold_last, Listing.price.desc())
    elif sort == "relevance" and groups:
        query = query.order_by(sold_last, relevance(Listing, groups, q).desc(), Listing.created_at.desc())
    else:
        query = query.order_by(sold_last, Listing.created_at.desc())

    items, total, page, page_size, pages = paginate(query, page, page_size)
    return ListingListOut(
        items=[ListingOut.from_orm_with_art(i) for i in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.get("/recommended", response_model=RecommendedOut)
def recommended_listings(
    exclude_id: Optional[int] = None,
    campus_id: Optional[int] = None,
    category_scores: Optional[str] = None,  # JSON like {"Electronics": 2.0}, built by the frontend
    only_categories: Optional[str] = None,  # JSON list, e.g. ["F&B"]: restrict picks to these (the student's interests)
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

    only: list[str] = []
    if only_categories:
        try:
            parsed = json.loads(only_categories)
            if isinstance(parsed, list):
                only = [str(c) for c in parsed if c]
        except (ValueError, TypeError):
            only = []

    query = db.query(Listing).filter(Listing.status == "available", _not_expired(), live(Listing))
    if exclude_id:
        query = query.filter(Listing.id != exclude_id)
    if only:
        # "Picked for you" with chosen interests shows only those categories, never filler.
        query = query.filter(Listing.category.in_(only))
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
    listing = db.query(Listing).filter(Listing.id == listing_id, live(Listing)).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return ListingOut.from_orm_with_art(listing)


@router.post("", response_model=ListingOut)
def create_listing(
    request: Request,
    body: tuple[dict, list] = Depends(_listing_body),
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    """Multipart: `data` (the fields as JSON) and 1-3 `files`. Every listing needs a photo."""
    if not user.profile_completed:
        raise HTTPException(status_code=403, detail="Complete your profile before listing an item")
    if not user.phone:
        raise HTTPException(status_code=403, detail="Add your WhatsApp number in your profile so buyers can contact you")
    data, files = body
    payload = _parse(ListingCreate, data)
    if not files:
        raise HTTPException(status_code=422, detail="Add at least one photo of the item")
    if len(files) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"A listing can have at most {MAX_IMAGES} photos")
    checked = _check_photos(files)

    listing = Listing(**payload.model_dump(), owner_id=user.id)
    _apply_food_rules(listing, check_expiry=True)
    _apply_mrp_rule(listing)
    listing.images = _store_photos(checked, request)
    db.add(listing)
    _commit_or_drop_photos(db, listing.images)
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)


@router.put("/{listing_id}", response_model=ListingOut)
def update_listing(
    listing_id: int,
    request: Request,
    body: tuple[dict, list] = Depends(_listing_body),
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    """JSON, or multipart with new photos in `files` (added after the kept ones)."""
    raw, files = body
    payload = _parse(ListingUpdate, raw)
    listing = _get_owned_listing(listing_id, db, user)
    data = payload.model_dump(exclude_unset=True)

    keep = data.pop("images", None)
    photos_change = keep is not None or bool(files)
    current = list(listing.images or []) if photos_change else []
    kept = current if keep is None else [u for u in current if u in keep]  # can only keep photos it already has
    if len(kept) + len(files) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"A listing can have at most {MAX_IMAGES} photos")
    if current and not kept and not files:
        raise HTTPException(status_code=422, detail="Keep at least one photo of the item")
    checked = _check_photos(files)
    removed = [u for u in current if u not in kept]

    for key, value in data.items():
        setattr(listing, key, value)
    # Only re-check the expiry date when it's being changed, so an expired item can still be edited.
    _apply_food_rules(listing, check_expiry="expiry_date" in data)
    _apply_mrp_rule(listing)
    added = _store_photos(checked, request)
    if photos_change:
        listing.images = [*kept, *added]
    _commit_or_drop_photos(db, added)
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
    """Moves the listing to the owner's Deleted tab; it can be restored for 24 hours."""
    listing = _get_owned_listing(listing_id, db, user)
    listing.deleted_at = utcnow()
    db.commit()
    purge_deleted_listings(db)


@router.post("/{listing_id}/restore", response_model=ListingOut)
def restore_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    listing = (
        db.query(Listing)
        .filter(Listing.id == listing_id, Listing.owner_id == user.id, Listing.deleted_at >= restore_cutoff())
        .first()
    )
    if not listing:
        raise HTTPException(status_code=404, detail="This listing can't be restored any more")
    listing.deleted_at = None
    db.commit()
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)


def purge_deleted_listings(db: Session) -> None:
    """Permanently remove listings deleted more than 24 hours ago, with their photos."""
    expired = db.query(Listing).filter(Listing.deleted_at < restore_cutoff()).all()
    if not expired:
        return
    photos = [url for listing in expired for url in (listing.images or [])]
    for listing in expired:
        db.delete(listing)
    db.commit()
    _delete_upload_files(photos)  # after the commit, so a failed delete never loses photos


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

    urls = _store_photos(_check_photos(files[:room]), request)
    listing.images = [*(listing.images or []), *urls]
    _commit_or_drop_photos(db, urls)
    db.refresh(listing)
    return ListingOut.from_orm_with_art(listing)
