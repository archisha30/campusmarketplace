from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.moderation import REPORTS_PER_DAY, notify_report
from app.core.timeutil import utcnow
from app.core.security import require_verified
from app.core.trash import live
from app.db.session import get_db
from app.models.listing import Listing
from app.models.report import Report
from app.models.resource import Resource
from app.models.user import User
from app.schemas.report import ReportIn

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.post("", status_code=201)
def create_report(
    payload: ReportIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified),
):
    """Report a listing or resource. Admins see the full report under Admin → Reports; the
    seller gets an anonymous notification (serious reasons wait for an admin: core/moderation.py)."""
    if payload.listing_id is not None:
        target_type, model, target_id = "listing", Listing, payload.listing_id
    else:
        target_type, model, target_id = "resource", Resource, payload.resource_id

    target = db.query(model).filter(model.id == target_id, live(model)).first()
    if not target:
        raise HTTPException(status_code=404, detail="That item no longer exists")
    if target.owner_id == user.id:
        raise HTTPException(status_code=400, detail="You can't report your own item")

    exists = (
        db.query(Report)
        .filter(Report.reporter_id == user.id, Report.target_type == target_type, Report.target_id == target.id)
        .first()
    )
    if exists:
        raise HTTPException(status_code=409, detail="You've already reported this. Our team will review it.")
    recent = db.query(Report).filter(Report.reporter_id == user.id, Report.created_at >= utcnow() - timedelta(days=1)).count()
    if recent >= REPORTS_PER_DAY:
        raise HTTPException(status_code=429, detail="You've sent a lot of reports today. Our team is reviewing them; try again tomorrow.")

    report = Report(
        reporter_id=user.id,
        owner_id=target.owner_id,
        target_type=target_type,
        target_id=target.id,
        target_title=target.title[:120],
        reason=payload.reason,
        details=payload.details,
    )
    db.add(report)
    try:
        # The seller sees the reason but not who reported it (see NotificationOut).
        notify_report(db, report, user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You've already reported this. Our team will review it.")
    return {"ok": True}
