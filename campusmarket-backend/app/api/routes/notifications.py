
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationListOut, NotificationOut
from app.core.timeutil import utcnow

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

LIST_LIMIT = 100


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
    ).update({Notification.read_at: utcnow()}, synchronize_session=False)
    db.commit()


@router.delete("/{notification_id}", status_code=204)
def dismiss_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Dismiss (delete) one of your own notifications."""
    deleted = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user.id)
        .delete(synchronize_session=False)
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Notification not found")
    db.commit()


@router.delete("", status_code=204)
def dismiss_all(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Clear every notification you have."""
    db.query(Notification).filter(Notification.user_id == user.id).delete(synchronize_session=False)
    db.commit()
