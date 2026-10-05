from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.listing import Listing
from app.models.notification import Notification
from app.models.resource import Resource
from app.models.user import User
from app.schemas.notification import ContactIn, NotificationListOut, NotificationOut

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

LIST_LIMIT = 100
# Tapping WhatsApp twice in a row shouldn't notify the owner twice.
CONTACT_DEDUPE = timedelta(hours=1)


def notify(
    db: Session,
    *,
    recipient_id,
    actor: User,
    type: str,
    target_type: str,
    target_id: int,
    target_title: str,
    channel: str | None = None,
    note: str | None = None,
) -> Notification | None:
    """Queue a notification on the session (the caller commits). Never notifies yourself."""
    if recipient_id == actor.id:
        return None
    n = Notification(
        user_id=recipient_id,
        actor_id=actor.id,
        type=type,
        channel=channel,
        target_type=target_type,
        target_id=target_id,
        target_title=target_title[:120],
        note=note,
    )
    db.add(n)
    return n


@router.get("", response_model=NotificationListOut)
def list_notifications(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = (
        db.query(Notification)
        .options(joinedload(Notification.actor))
        .filter(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(LIST_LIMIT)
        .all()
    )
    unread = (
        db.query(Notification)
        .filter(Notification.user_id == user.id, Notification.read_at.is_(None))
        .count()
    )
    return NotificationListOut(items=[NotificationOut.from_model(n) for n in rows], unread=unread)


@router.post("/read-all", status_code=204)
def mark_all_read(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == user.id, Notification.read_at.is_(None)
    ).update({Notification.read_at: datetime.utcnow()}, synchronize_session=False)
    db.commit()


@router.post("/contact", status_code=204)
def record_contact(
    payload: ContactIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Called when a student taps WhatsApp / Email on a listing or resource."""
    if not user.verified:
        raise HTTPException(status_code=403, detail="Verify your college email first")

    model = Listing if payload.target_type == "listing" else Resource
    target = db.query(model).filter(model.id == payload.target_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Not found")

    recent = (
        db.query(Notification)
        .filter(
            Notification.actor_id == user.id,
            Notification.type == "contact",
            Notification.target_type == payload.target_type,
            Notification.target_id == target.id,
            Notification.channel == payload.channel,
            Notification.created_at >= datetime.utcnow() - CONTACT_DEDUPE,
        )
        .first()
    )
    if recent:
        return

    notify(
        db,
        recipient_id=target.owner_id,
        actor=user,
        type="contact",
        channel=payload.channel,
        target_type=payload.target_type,
        target_id=target.id,
        target_title=target.title,
    )
    db.commit()
