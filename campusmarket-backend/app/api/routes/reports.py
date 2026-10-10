from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.routes.notifications import notify
from app.core.security import require_verified
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
    """Report a listing or resource. The seller gets an anonymous notification;
    admins see the full report under Admin → Reports."""
    if payload.listing_id is not None:
        target_type, model, target_id = "listing", Listing, payload.listing_id
    else:
        target_type, model, target_id = "resource", Resource, payload.resource_id

    target = db.query(model).filter(model.id == target_id).first()
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

    db.add(Report(
        reporter_id=user.id,
        owner_id=target.owner_id,
        target_type=target_type,
        target_id=target.id,
        target_title=target.title[:120],
        reason=payload.reason,
        details=payload.details,
    ))
    # The seller sees the reason but not who reported it (see NotificationOut).
    notify(
        db,
        recipient_id=target.owner_id,
        actor=user,
        type="report",
        target_type=target_type,
        target_id=target.id,
        target_title=target.title,
        note=payload.reason,
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="You've already reported this. Our team will review it.")
    return {"ok": True}
