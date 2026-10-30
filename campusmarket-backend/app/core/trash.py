"""Owner deletes are soft for RESTORE_HOURS, so a listing or resource can be restored
from the Seller Dashboard's Deleted tab. After that it's removed for good, with its files.

Also the visibility filters every query uses: existing() for owners and admins, live() for
everyone else (which also hides items held for review)."""

from datetime import datetime, timedelta

from sqlalchemy import select

from app.models.user import User
from app.core.timeutil import utcnow

RESTORE_HOURS = 24


def restore_cutoff() -> datetime:
    """Items deleted before this moment can no longer be restored."""
    return utcnow() - timedelta(hours=RESTORE_HOURS)


def restore_until(deleted_at: datetime) -> datetime:
    return deleted_at + timedelta(hours=RESTORE_HOURS)


def existing(model):
    """Filter for rows that haven't been deleted and whose owner isn't suspended (a suspended
    student's listings and resources disappear with the account). Owners and admins can still
    open these, including items held for review."""
    suspended = select(User.id).where(User.suspended_at.is_not(None))
    return model.deleted_at.is_(None) & model.owner_id.not_in(suspended)


def live(model):
    """What everyone else sees: existing, and not held for review after a pile-up of reports
    (core/moderation.py). Lists, search, recommendations, wishlists and contact all use this."""
    return existing(model) & model.held_at.is_(None)


def can_see_held(item, user) -> bool:
    """A held item still opens for its owner (so they can fix it) and for admins (to review it)."""
    return user is not None and (item.owner_id == user.id or user.is_admin)
