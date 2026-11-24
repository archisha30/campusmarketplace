"""Per-account posting and upload limits.

Without these, one account could post listings and resources without end (each can carry
photos or a PDF), filling Supabase Storage and sending a "matches your request" notification
for every post. Limits are per account, not per IP, since every student is logged in here.

* Posts are counted from the database (created_at), including ones in the Deleted tab, so
  deleting and re-posting doesn't reset the count, and a restart doesn't either.
* Uploaded files are counted in memory per account (core/ratelimit.py), like the login limits.
"""

import logging
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.ratelimit import SlidingWindowLimiter
from app.core.timeutil import utcnow
from app.models.user import User

HOUR = 60 * 60
photo_limiter = SlidingWindowLimiter(settings.PHOTO_UPLOADS_PER_HOUR, HOUR)
avatar_limiter = SlidingWindowLimiter(settings.AVATAR_UPLOADS_PER_HOUR, HOUR)

_log = logging.getLogger("campusmarket.ratelimit")


def check_post_limit(db: Session, model, user: User, per_hour: int, per_day: int, noun: str) -> None:
    """429 if `user` has created per_hour `model` rows in the last hour or per_day in the last day."""
    now = utcnow()
    mine = db.query(model).filter(model.owner_id == user.id)
    if mine.filter(model.created_at >= now - timedelta(hours=1)).count() >= per_hour:
        _log.warning("Post limit (hour) hit: user %s, %s", user.id, noun)
        raise HTTPException(status_code=429, detail=f"You've posted a lot of {noun}s in the last hour. Try again a bit later.")
    if mine.filter(model.created_at >= now - timedelta(days=1)).count() >= per_day:
        _log.warning("Post limit (day) hit: user %s, %s", user.id, noun)
        raise HTTPException(status_code=429, detail=f"You've reached today's limit of {per_day} {noun}s. Try again tomorrow.")


def check_upload_limit(limiter: SlidingWindowLimiter, user: User, files: int) -> None:
    """429 if uploading `files` more files would take `user` over the hourly limit."""
    if files and not limiter.allow(str(user.id), files):
        _log.warning("Upload limit hit: user %s, %d file(s)", user.id, files)
        raise HTTPException(status_code=429, detail="You've uploaded a lot of files in the last hour. Try again a bit later.")
