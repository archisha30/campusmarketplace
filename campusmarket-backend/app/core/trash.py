"""Owner deletes are soft for RESTORE_HOURS, so a listing or resource can be restored
from the Seller Dashboard's Deleted tab. After that it's removed for good, with its files."""

from datetime import datetime, timedelta

from sqlalchemy import select

from app.models.user import User

RESTORE_HOURS = 24


def restore_cutoff() -> datetime:
    """Items deleted before this moment can no longer be restored."""
    return datetime.utcnow() - timedelta(hours=RESTORE_HOURS)


def restore_until(deleted_at: datetime) -> datetime:
    return deleted_at + timedelta(hours=RESTORE_HOURS)


def live(model):
    """Filter for rows that haven't been deleted and whose owner isn't suspended
    (a suspended student's listings and resources disappear with the account)."""
    suspended = select(User.id).where(User.suspended_at.is_not(None))
    return model.deleted_at.is_(None) & model.owner_id.not_in(suspended)
