import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.api.routes.resources import _owner_out, _resource_out
from app.core.config import settings
from app.core.pagination import paginate
from app.core.security import require_admin, require_owner
from app.core.storage import delete_public_urls
from app.db.session import get_db
from app.models.banned_email import BannedEmail
from app.models.listing import Listing
from app.models.report import Report
from app.models.resource import Resource
from app.models.user import User
from app.schemas.listing import ListingOut
from app.schemas.report import AdminReportOut, AdminReportsOut, ReportPersonOut, ReportStatusIn
from app.schemas.resource import ResourceOut

# Admin dashboard: the owner(s) in OWNER_EMAILS plus the admins they approve.
router = APIRouter(prefix="/api/admin", tags=["admin"])

ADMIN_PAGE_SIZE = 25


class AdminUserOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    avatar_url: str | None = None
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
    suspended: bool = False
    suspended_at: datetime | None = None
    suspension_reason: str | None = None


class AdminUsersOut(BaseModel):
    items: list[AdminUserOut]
    total: int  # users matching the search (all pages)
    page: int
    page_size: int
    pages: int
    # Site-wide counts for the summary cards (not just this page or search).
    verified: int
    sellers: int
    admins: int
    suspended: int


class AdminRoleIn(BaseModel):
    is_admin: bool


class SuspendIn(BaseModel):
    # Shown to other admins in the Users table, so say which rule was broken.
    reason: str = Field(max_length=300)

    @field_validator("reason")
    @classmethod
    def needs_reason(cls, value: str) -> str:
        value = " ".join(value.split())
        if len(value) < 3:
            raise ValueError("Say why the account is being suspended")
        return value


class AdminListingsOut(BaseModel):
    items: list[ListingOut]
    total: int
    page: int
    page_size: int
    pages: int
    available: int  # site-wide


class AdminResourcesOut(BaseModel):
    items: list[ResourceOut]
    total: int
    page: int
    page_size: int
    pages: int
    open: int  # site-wide, status "available"


def _counts(db: Session, model) -> dict:
    return dict(db.query(model.owner_id, func.count(model.id)).filter(model.deleted_at.is_(None)).group_by(model.owner_id).all())


def _user_out(u: User, listings: dict, resources: dict) -> AdminUserOut:
    return AdminUserOut(
        id=str(u.id),
        email=u.email,
        name=u.name,
        avatar_url=u.avatar_url,
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
        suspended=bool(u.suspended_at),
        suspended_at=u.suspended_at,
        suspension_reason=u.suspension_reason,
    )


def _target_user(db: Session, user_id: str) -> User:
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="User not found")
    target = db.query(User).filter(User.id == uid).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    return target


@router.get("/users", response_model=AdminUsersOut)
def list_users(
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = ADMIN_PAGE_SIZE,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = db.query(User)
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(User.email.ilike(like), User.name.ilike(like)))
    users, total, page, page_size, pages = paginate(query.order_by(User.created_at.desc(), User.id), page, page_size)
    listings, resources = _counts(db, Listing), _counts(db, Resource)
    owner_emails = [e.lower() for e in settings.OWNER_EMAILS]
    return AdminUsersOut(
        items=[_user_out(u, listings, resources) for u in users],
        total=total, page=page, page_size=page_size, pages=pages,
        verified=db.query(User).filter(User.verified.is_(True)).count(),
        sellers=db.query(User).filter(User.account_type == "seller").count(),
        admins=db.query(User).filter(or_(User.role == "admin", func.lower(User.email).in_(owner_emails))).count(),
        suspended=db.query(User).filter(User.suspended_at.is_not(None)).count(),
    )


@router.patch("/users/{user_id}/admin", response_model=AdminUserOut)
def set_admin(
    user_id: str,
    payload: AdminRoleIn,
    db: Session = Depends(get_db),
    _owner: User = Depends(require_owner),
):
    """Approve or remove an admin. Owners are admins through OWNER_EMAILS and can't be changed here."""
    target = _target_user(db, user_id)
    if target.is_owner:
        raise HTTPException(status_code=400, detail="Owners are always admins")
    if payload.is_admin and not target.verified:
        raise HTTPException(status_code=400, detail="Only verified students can be made admins")
    if payload.is_admin and target.suspended_at:
        raise HTTPException(status_code=400, detail="Suspended accounts can't be made admins")
    target.role = "admin" if payload.is_admin else "student"
    db.commit()
    db.refresh(target)
    return _user_out(target, _counts(db, Listing), _counts(db, Resource))


@router.post("/users/{user_id}/suspend", response_model=AdminUserOut)
def suspend_user(
    user_id: str,
    payload: SuspendIn,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Suspend an account for breaking the rules. Its sessions stop working at once, its
    listings, resources and requests disappear, and the email is banned from signing up,
    logging in or using Google sign-in again. Only the owner can suspend another admin."""
    target = _target_user(db, user_id)
    if target.id == admin.id:
        raise HTTPException(status_code=400, detail="You can't suspend your own account")
    if target.is_owner:
        raise HTTPException(status_code=400, detail="Owners can't be suspended")
    if target.is_admin and not admin.is_owner:
        raise HTTPException(status_code=403, detail="Only the owner can suspend an admin")
    if not target.suspended_at:
        target.suspended_at = datetime.utcnow()
    target.suspension_reason = payload.reason
    target.role = "student"  # loses admin access too
    email = target.email.strip().lower()
    ban = db.query(BannedEmail).filter(BannedEmail.email == email).first()
    if ban:
        ban.reason = payload.reason
    else:
        db.add(BannedEmail(email=email, reason=payload.reason, banned_by=admin.id))
    db.commit()
    db.refresh(target)
    return _user_out(target, _counts(db, Listing), _counts(db, Resource))


@router.post("/users/{user_id}/reinstate", response_model=AdminUserOut)
def reinstate_user(
    user_id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Undo a suspension made by mistake: the account, its content and its email work again."""
    target = _target_user(db, user_id)
    target.suspended_at = None
    target.suspension_reason = None
    db.query(BannedEmail).filter(BannedEmail.email == target.email.strip().lower()).delete(synchronize_session=False)
    db.commit()
    db.refresh(target)
    return _user_out(target, _counts(db, Listing), _counts(db, Resource))


@router.get("/listings", response_model=AdminListingsOut)
def list_all_listings(
    q: Optional[str] = None,
    page: int = 1,
    page_size: int = ADMIN_PAGE_SIZE,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every listing, including reserved and sold ones."""
    query = db.query(Listing).options(joinedload(Listing.owner)).filter(Listing.deleted_at.is_(None))
    if q and q.strip():
        query = query.filter(Listing.title.ilike(f"%{q.strip()}%"))
    items, total, page, page_size, pages = paginate(query.order_by(Listing.created_at.desc(), Listing.id.desc()), page, page_size)
    return AdminListingsOut(
        items=[ListingOut.from_orm_with_art(i, include_contact=True) for i in items],
        total=total, page=page, page_size=page_size, pages=pages,
        available=db.query(Listing).filter(Listing.status == "available", Listing.deleted_at.is_(None)).count(),
    )


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
    page: int = 1,
    page_size: int = ADMIN_PAGE_SIZE,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every resource, including closed ones, with the owner's contact details.
    Deleting one uses the normal DELETE /api/resources/{id}, which already allows admins."""
    query = db.query(Resource).options(joinedload(Resource.owner)).filter(Resource.deleted_at.is_(None))
    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Resource.title.ilike(like), Resource.subject.ilike(like)))
    rows, total, page, page_size, pages = paginate(query.order_by(Resource.created_at.desc(), Resource.id.desc()), page, page_size)
    items = []
    for r in rows:
        out = _resource_out(r, request)
        out.owner = _owner_out(r.owner, with_contact=True)
        items.append(out)
    return AdminResourcesOut(
        items=items, total=total, page=page, page_size=page_size, pages=pages,
        open=db.query(Resource).filter(Resource.status == "available", Resource.deleted_at.is_(None)).count(),
    )


def _person(u: User) -> ReportPersonOut:
    return ReportPersonOut(id=str(u.id), name=u.name or u.email.split("@")[0], email=u.email)


@router.get("/reports", response_model=AdminReportsOut)
def list_reports(
    status: Optional[str] = None,  # "open" | "resolved"; omit for all
    page: int = 1,
    page_size: int = ADMIN_PAGE_SIZE,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """Every report, newest first, with who reported what (admins only)."""
    query = db.query(Report).options(joinedload(Report.reporter), joinedload(Report.owner))
    if status in ("open", "resolved"):
        query = query.filter(Report.status == status)
    rows, total, page, page_size, pages = paginate(query.order_by(Report.created_at.desc(), Report.id.desc()), page, page_size)

    per_item = dict(
        ((t, i), n)
        for t, i, n in db.query(Report.target_type, Report.target_id, func.count(Report.id))
        .group_by(Report.target_type, Report.target_id)
        .all()
    )
    listing_ids = {id_ for (id_,) in db.query(Listing.id).filter(Listing.deleted_at.is_(None), Listing.id.in_([r.target_id for r in rows if r.target_type == "listing"])).all()}
    resource_ids = {id_ for (id_,) in db.query(Resource.id).filter(Resource.deleted_at.is_(None), Resource.id.in_([r.target_id for r in rows if r.target_type == "resource"])).all()}

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
    return AdminReportsOut(items=items, open=open_count, total=total, page=page, page_size=page_size, pages=pages)


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
