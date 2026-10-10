import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.routes.resources import _owner_out, _resource_out
from app.core.security import require_admin, require_owner
from app.core.storage import delete_public_urls
from app.db.session import get_db
from app.models.listing import Listing
from app.models.report import Report
from app.models.resource import Resource
from app.models.user import User
from app.schemas.listing import ListingOut
from app.schemas.report import AdminReportOut, AdminReportsOut, ReportPersonOut, ReportStatusIn
from app.schemas.resource import ResourceOut

# Admin dashboard: the owner(s) in OWNER_EMAILS plus the admins they approve.
router = APIRouter(prefix="/api/admin", tags=["admin"])


class AdminUserOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    college: str | None = None
    course: str | None = None
    year: str | None = None
    phone: str | None = None
    account_type: str
    is_admin: bool
    is_owner: bool
    verified: bool
    profile_completed: bool
    created_at: datetime | None = None
    listings: int = 0
    resources: int = 0


class AdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminRoleIn(BaseModel):
    is_admin: bool


class AdminListingsOut(BaseModel):
    items: list[ListingOut]
    total: int


class AdminResourcesOut(BaseModel):
    items: list[ResourceOut]
    total: int


def _counts(db: Session, model) -> dict:
    return dict(db.query(model.owner_id, func.count(model.id)).group_by(model.owner_id).all())


def _user_out(u: User, listings: dict, resources: dict) -> AdminUserOut:
    return AdminUserOut(
        id=str(u.id),
        email=u.email,
        name=u.name,
        college=u.college,
        course=u.course,
        year=u.year,
        phone=u.phone,
        account_type=u.account_type,
        is_admin=u.is_admin,
        is_owner=u.is_owner,
        verified=bool(u.verified),
        profile_completed=bool(u.profile_completed),
        created_at=u.created_at,
        listings=listings.get(u.id, 0),
        resources=resources.get(u.id, 0),
    )


@router.get("/users", response_model=AdminUsersOut)
def list_users(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.name.ilike(like)))
    users = query.order_by(User.created_at.desc()).all()
    listings, resources = _counts(db, Listing), _counts(db, Resource)
    return AdminUsersOut(items=[_user_out(u, listings, resources) for u in users], total=len(users))


@router.patch("/users/{user_id}/admin", response_model=AdminUserOut)
def set_admin(
    user_id: str,
    payload: AdminRoleIn,
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """Approve or remove an admin. Owners are admins through OWNER_EMAILS and can't be changed here."""
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    target = db.query(User).filter(User.id == uid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_owner:
        raise HTTPException(status_code=400, detail="Owners are always admins")
    if payload.is_admin and not target.verified:
        raise HTTPException(status_code=400, detail="Only verified students can be made admins")
    target.role = "admin" if payload.is_admin else "student"
    db.commit()
    db.refresh(target)
    return _user_out(target, _counts(db, Listing), _counts(db, Resource))


@router.get("/listings", response_model=AdminListingsOut)
def list_all_listings(
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every listing, including reserved and sold ones."""
    query = db.query(Listing).options(joinedload(Listing.owner))
    if q and q.strip():
        query = query.filter(Listing.title.ilike(f"%{q.strip()}%"))
    items = query.order_by(Listing.created_at.desc()).all()
    return AdminListingsOut(items=[ListingOut.from_orm_with_art(i) for i in items], total=len(items))


@router.delete("/listings/{listing_id}", status_code=204)
def delete_any_listing(
    listing_id: int,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Moderation: remove someone's listing, with its photos."""
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    photos = list(listing.images or [])
    db.delete(listing)
    db.commit()
    delete_public_urls(photos)


@router.get("/resources", response_model=AdminResourcesOut)
def list_all_resources(
    request: Request,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every resource, including closed ones, with the owner's contact details.
    Deleting one uses the normal DELETE /api/resources/{id}, which already allows admins."""
    query = db.query(Resource).options(joinedload(Resource.owner))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Resource.title.ilike(like), Resource.subject.ilike(like)))
    rows = query.order_by(Resource.created_at.desc(), Resource.id.desc()).all()
    items = []
    for r in rows:
        out = _resource_out(r, request)
        out.owner = _owner_out(r.owner, with_contact=True)
        items.append(out)
    return AdminResourcesOut(items=items, total=len(items))


def _person(u: User) -> ReportPersonOut:
    return ReportPersonOut(id=str(u.id), name=u.name or u.email.split("@")[0], email=u.email)


@router.get("/reports", response_model=AdminReportsOut)
def list_reports(
    status: Optional[str] = None,  # "open" | "resolved"; omit for all
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every report, newest first, with who reported what (admins only)."""
    query = db.query(Report).options(joinedload(Report.reporter), joinedload(Report.owner))
    if status in ("open", "resolved"):
        query = query.filter(Report.status == status)
    rows = query.order_by(Report.created_at.desc(), Report.id.desc()).all()

    per_item = dict(
        ((t, i), n)
        for t, i, n in db.query(Report.target_type, Report.target_id, func.count(Report.id))
        .group_by(Report.target_type, Report.target_id)
        .all()
    )
    listing_ids = {id_ for (id_,) in db.query(Listing.id).filter(Listing.id.in_([r.target_id for r in rows if r.target_type == "listing"])).all()}
    resource_ids = {id_ for (id_,) in db.query(Resource.id).filter(Resource.id.in_([r.target_id for r in rows if r.target_type == "resource"])).all()}

    items = [
        AdminReportOut(
            id=r.id,
            target_type=r.target_type,
            target_id=r.target_id,
            target_title=r.target_title,
            target_exists=r.target_id in (listing_ids if r.target_type == "listing" else resource_ids),
            reason=r.reason,
            details=r.details,
            status=r.status,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
            reporter=_person(r.reporter),
            owner=_person(r.owner),
            reports_on_item=per_item.get((r.target_type, r.target_id), 1),
        )
        for r in rows
    ]
    open_count = db.query(Report).filter(Report.status == "open").count()
    return AdminReportsOut(items=items, open=open_count)


@router.patch("/reports/{report_id}", status_code=204)
def set_report_status(
    report_id: int,
    payload: ReportStatusIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = payload.status
    report.resolved_at = datetime.utcnow() if payload.status == "resolved" else None
    db.commit()
