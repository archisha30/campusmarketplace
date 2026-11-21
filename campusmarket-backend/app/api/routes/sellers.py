import uuid

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.routes.listings import _not_expired
from app.api.routes.resources import _resource_out
from app.core.security import require_verified
from app.core.trash import existing, live
from app.db.session import get_db
from app.models.listing import Listing
from app.models.resource import Resource
from app.models.user import User
from app.schemas.listing import ListingOut
from app.schemas.seller import SellerProfileOut

router = APIRouter(prefix="/api/sellers", tags=["sellers"])

ITEM_LIMIT = 60


@router.get("/{user_id}", response_model=SellerProfileOut)
def seller_profile(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Student not found")
    user = db.query(User).filter(User.id == uid, User.verified.is_(True), User.suspended_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="Student not found")

    sold = db.query(Listing).filter(Listing.owner_id == uid, Listing.status == "sold", existing(Listing)).count()
    listings = (
        db.query(Listing)
        .filter(Listing.owner_id == uid, Listing.status.in_(("available", "reserved")), _not_expired(), live(Listing))
        .order_by(Listing.created_at.desc())
        .limit(ITEM_LIMIT)
        .all()
    )
    resources = (
        db.query(Resource)
        .filter(Resource.owner_id == uid, Resource.status == "available", live(Resource))
        .order_by(Resource.created_at.desc())
        .limit(ITEM_LIMIT)
        .all()
    )
    return SellerProfileOut(
        id=str(user.id),
        name=user.display_name,
        avatar_url=user.avatar_url,
        college=user.college,
        joined_at=user.created_at,
        sold_count=sold,
        listings=[ListingOut.from_orm_with_art(l) for l in listings],
        resources=[_resource_out(r, request) for r in resources],
    )
