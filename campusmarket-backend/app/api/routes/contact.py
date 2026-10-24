from datetime import datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.routes.notifications import notify
from app.core.config import settings
from app.core.security import require_verified
from app.core.trash import live
from app.db.session import get_db
from app.models.contact_reveal import ContactReveal
from app.models.listing import Listing
from app.models.notification import Notification
from app.models.product_request import ProductRequest
from app.models.resource import Resource
from app.models.user import User

# Phone numbers and emails are never sent in lists or detail pages. A student gets ONE person's
# contact here, when they tap Contact Seller (or Reply on a "Looking for" request), and each
# reveal is logged and rate-limited so the whole campus can't be scraped.
router = APIRouter(prefix="/api/contact", tags=["contact"])

# Tapping WhatsApp twice in a row shouldn't notify the seller twice.
NOTIFY_DEDUPE = timedelta(hours=1)
# Revealing the same person again within this window doesn't count against the limits.
REVEAL_DEDUPE = timedelta(days=1)


class ContactIn(BaseModel):
    target_type: Literal["listing", "resource", "request"]
    target_id: int
    channel: Literal["whatsapp", "email"]


class ContactOut(BaseModel):
    name: str
    phone: str | None = None  # only for channel "whatsapp"
    email: str | None = None  # only for channel "email"


def _load_target(db: Session, payload: ContactIn, user: User):
    """(owner, title) of the thing being contacted about."""
    if payload.target_type == "request":
        # The "Looking for" feed is for sellers; replying reveals the requester's contact.
        if user.account_type != "seller" and not user.is_admin:
            raise HTTPException(status_code=403, detail="Only sellers can reply to requests")
        req = db.query(ProductRequest).filter(ProductRequest.id == payload.target_id).first()
        if not req:
            raise HTTPException(status_code=404, detail="That request no longer exists")
        return req.user, req.product
    model = Listing if payload.target_type == "listing" else Resource
    target = db.query(model).filter(model.id == payload.target_id, live(model)).first()
    if not target:
        raise HTTPException(status_code=404, detail="That item no longer exists")
    return target.owner, target.title


def _check_limits(db: Session, user: User, payload: ContactIn) -> bool:
    """True if this is a new reveal that should be logged; raises 429 when over the limits."""
    now = datetime.utcnow()
    already = (
        db.query(ContactReveal)
        .filter(
            ContactReveal.user_id == user.id,
            ContactReveal.target_type == payload.target_type,
            ContactReveal.target_id == payload.target_id,
            ContactReveal.created_at >= now - REVEAL_DEDUPE,
        )
        .first()
    )
    if already:
        return False
    recent = db.query(ContactReveal).filter(ContactReveal.user_id == user.id)
    if recent.filter(ContactReveal.created_at >= now - timedelta(hours=1)).count() >= settings.CONTACT_REVEALS_PER_HOUR:
        raise HTTPException(status_code=429, detail="You've contacted a lot of people in the last hour. Try again a bit later.")
    if recent.filter(ContactReveal.created_at >= now - timedelta(days=1)).count() >= settings.CONTACT_REVEALS_PER_DAY:
        raise HTTPException(status_code=429, detail="You've reached today's limit for contacting people. Try again tomorrow.")
    return True


@router.post("", response_model=ContactOut)
def reveal_contact(
    payload: ContactIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    owner, title = _load_target(db, payload, user)
    if payload.channel == "whatsapp" and not owner.phone:
        raise HTTPException(status_code=404, detail="They haven't added a WhatsApp number. Try email instead.")

    is_self = owner.id == user.id
    if not is_self and _check_limits(db, user, payload):
        db.add(ContactReveal(user_id=user.id, target_type=payload.target_type, target_id=payload.target_id))

    # Let sellers know someone reached out about their listing/resource (once an hour per channel).
    if payload.target_type in ("listing", "resource") and not is_self:
        recent = (
            db.query(Notification)
            .filter(
                Notification.actor_id == user.id,
                Notification.type == "contact",
                Notification.target_type == payload.target_type,
                Notification.target_id == payload.target_id,
                Notification.channel == payload.channel,
                Notification.created_at >= datetime.utcnow() - NOTIFY_DEDUPE,
            )
            .first()
        )
        if not recent:
            notify(
                db,
                recipient_id=owner.id,
                actor=user,
                type="contact",
                channel=payload.channel,
                target_type=payload.target_type,
                target_id=payload.target_id,
                target_title=title,
            )
    db.commit()

    return ContactOut(
        name=owner.name or owner.email.split("@")[0],
        phone=owner.phone if payload.channel == "whatsapp" else None,
        email=owner.email if payload.channel == "email" else None,
    )
