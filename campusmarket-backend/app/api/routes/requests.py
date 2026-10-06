from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user, require_seller
from app.db.session import get_db
from app.models.product_request import ProductRequest
from app.models.user import User
from app.schemas.product_request import ProductRequestCreate, ProductRequestOut

router = APIRouter(prefix="/api/requests", tags=["requests"])

# Requests older than this drop off sellers' dashboards.
VISIBLE_FOR = timedelta(days=30)
DAILY_LIMIT = 5


@router.post("", response_model=ProductRequestOut, status_code=201)
def create_request(
    payload: ProductRequestCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user.verified:
        raise HTTPException(status_code=403, detail="Verify your college email first")
    since = datetime.utcnow() - timedelta(days=1)
    recent = (
        db.query(ProductRequest)
        .filter(ProductRequest.user_id == user.id, ProductRequest.created_at >= since)
        .count()
    )
    if recent >= DAILY_LIMIT:
        raise HTTPException(status_code=429, detail=f"You can post up to {DAILY_LIMIT} requests a day")

    req = ProductRequest(user_id=user.id, product=payload.product, description=payload.description)
    db.add(req)
    db.commit()
    db.refresh(req)
    return ProductRequestOut.from_model(req)


@router.get("", response_model=list[ProductRequestOut])
def list_requests(
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    """Sellers' notification feed: recent requests from other students, newest first."""
    rows = (
        db.query(ProductRequest)
        .options(joinedload(ProductRequest.user))
        .filter(
            ProductRequest.created_at >= datetime.utcnow() - VISIBLE_FOR,
            ProductRequest.user_id != user.id,
        )
        .order_by(ProductRequest.created_at.desc())
        .limit(100)
        .all()
    )
    return [ProductRequestOut.from_model(r) for r in rows]


@router.get("/mine", response_model=list[ProductRequestOut])
def my_requests(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(ProductRequest)
        .filter(ProductRequest.user_id == user.id)
        .order_by(ProductRequest.created_at.desc())
        .all()
    )
    return [ProductRequestOut.from_model(r) for r in rows]


@router.delete("/{request_id}", status_code=204)
def delete_request(
    request_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    req = db.query(ProductRequest).filter(ProductRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.user_id != user.id and not user.is_admin:
        raise HTTPException(status_code=403, detail="You can only delete your own requests")
    db.delete(req)
    db.commit()
