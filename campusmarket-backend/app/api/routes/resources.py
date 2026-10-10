import json
import re
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

import pymupdf as fitz
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.responses import Response
from pydantic import ValidationError
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.routes.notifications import notify
from app.core.pdf_preview import PdfError, open_pdf, read_limited, render_previews
from app.core.security import get_current_user, require_seller, require_verified
from app.core.storage import storage
from app.db.session import get_db
from app.models.resource import Resource, ResourceAccess
from app.models.user import User
from app.schemas.resource import (
    SUBJECTS,
    AccessDecision,
    AccessOut,
    AccessRequestIn,
    AccessRequestOut,
    FacetsOut,
    OwnerOut,
    PreviewPage,
    ResourceIn,
    ResourceListOut,
    ResourceRecommendedOut,
    ResourceOut,
    StatusUpdate,
)

router = APIRouter(prefix="/api/resources", tags=["resources"])

# Original PDFs go to PRIVATE storage and are only ever streamed through
# GET /api/resources/{id}/file after an access check. Rendered preview JPEGs are public:
# page 1 sharp, the rest blurred server-side. See app/core/storage.py.
PREVIEW_PREFIX = "resource-previews/"
PDF_PREFIX = "resources/"

# Stored files touched by a request, as ("public" | "private", key), for cleanup.
StoredFiles = list[tuple[str, str]]


# ---------- files ----------


@dataclass
class _Pdf:
    data: bytes
    doc: fitz.Document


def _read_pdf(file: UploadFile | None) -> _Pdf | None:
    """Validate an uploaded PDF fully before anything touches the DB or storage."""
    if file is None or not file.filename:
        return None
    try:
        data = read_limited(file.file)
        return _Pdf(data, open_pdf(data))
    except PdfError as e:
        status = 413 if "under" in str(e) else 400
        raise HTTPException(status_code=status, detail=str(e))


def _wants_half_blur(r: Resource) -> bool:
    # A single-page PDF we host for sale would be given away by a sharp page 1.
    return r.copy_type == "soft" and r.delivery == "pdf" and r.offer_type == "sale"


def _write_previews(r: Resource, doc: fitz.Document, written: StoredFiles) -> None:
    token = uuid.uuid4().hex
    pages = []
    for i, img in enumerate(render_previews(doc, half_blur_single_page=_wants_half_blur(r)), start=1):
        key = f"{PREVIEW_PREFIX}{token}-p{i}.jpg"
        storage.put_public(key, img.data, "image/jpeg")
        written.append(("public", key))
        pages.append({"key": key, "kind": img.kind})
    r.preview_pages = pages
    r.page_count = doc.page_count


def _store_pdf(r: Resource, pdf: _Pdf, written: StoredFiles) -> None:
    key = f"{PDF_PREFIX}{uuid.uuid4().hex}.pdf"
    storage.put_private(key, pdf.data, "application/pdf")
    written.append(("private", key))
    r.file_name = key
    _write_previews(r, pdf.doc, written)


def _pdf_key(r: Resource) -> str | None:
    if not r.file_name:
        return None
    # Rows saved before cloud storage hold a bare "<uuid>.pdf".
    return r.file_name if "/" in r.file_name else PDF_PREFIX + r.file_name


def _preview_key(page: dict) -> str:
    return page.get("key") or PREVIEW_PREFIX + page["name"]


def _resource_files(r: Resource) -> StoredFiles:
    files: StoredFiles = [("public", _preview_key(p)) for p in (r.preview_pages or [])]
    if key := _pdf_key(r):
        files.append(("private", key))
    return files


def _remove_files(files: StoredFiles) -> None:
    storage.delete_public([k for kind, k in files if kind == "public"])
    storage.delete_private([k for kind, k in files if kind == "private"])


def _clear_file(r: Resource) -> None:
    r.file_name = None
    r.page_count = None
    r.preview_pages = []


def _check_file_rules(fields: ResourceIn, has_file: bool) -> None:
    if fields.copy_type == "soft" and fields.delivery == "pdf" and not has_file:
        raise HTTPException(status_code=400, detail="Upload the PDF you're sharing")
    if fields.copy_type == "soft" and fields.delivery == "drive" and not has_file:
        raise HTTPException(status_code=400, detail="Drive links need a sample PDF so students can preview it")


# ---------- access ----------


def _access(r: Resource, user: User | None, db: Session) -> AccessOut:
    req = None
    if user:
        req = (
            db.query(ResourceAccess)
            .filter(ResourceAccess.resource_id == r.id, ResourceAccess.user_id == user.id)
            .first()
        )
    req_out = _request_out(req) if req else None

    if user and r.owner_id == user.id:
        return AccessOut(full=True, reason="owner")
    if user and user.is_admin:
        return AccessOut(full=True, reason="admin")
    if not user:
        return AccessOut(full=False, reason="guest")
    if not user.verified:
        return AccessOut(full=False, reason="unverified")
    if req and req.status == "approved":
        return AccessOut(full=True, reason="granted", request=req_out)
    if r.status == "closed":
        return AccessOut(full=False, reason="closed", request=req_out)
    if r.offer_type == "free":
        return AccessOut(full=True, reason="free")
    can_request = req is None or req.status == "denied"
    return AccessOut(full=False, reason="locked", can_request=can_request, request=req_out)


def _owner_out(u: User, with_contact: bool) -> OwnerOut:
    return OwnerOut(
        id=str(u.id),
        name=u.name or u.email.split("@")[0],
        avatar_url=u.avatar_url,
        verified=bool(u.verified),
        campus=u.college,
        phone=u.phone if with_contact else None,
        email=u.email if with_contact else None,
    )


def _request_out(req: ResourceAccess, with_requester: bool = False) -> AccessRequestOut:
    return AccessRequestOut(
        id=req.id,
        status=req.status,
        note=req.note,
        created_at=req.created_at,
        updated_at=req.updated_at,
        decided_at=req.decided_at,
        requester=_owner_out(req.user, with_contact=True) if with_requester else None,
    )


def _resource_out(
    r: Resource, request: Request, viewer: User | None = None, db: Session | None = None, detail: bool = False
) -> ResourceOut:
    base = str(request.base_url)
    pages = [PreviewPage(url=storage.public_url(_preview_key(p), base), kind=p["kind"]) for p in (r.preview_pages or [])]
    out = ResourceOut(
        id=r.id,
        title=r.title,
        subject=r.subject,
        year=r.year,
        copy_type=r.copy_type,
        offer_type=r.offer_type,
        price=r.price,
        description=r.description,
        status=r.status,
        delivery=r.delivery,
        pickup_spot=r.pickup_spot,
        has_file=bool(r.file_name),
        page_count=r.page_count,
        preview_pages=pages,
        thumbnail_url=pages[0].url if pages else None,
        created_at=r.created_at,
        updated_at=r.updated_at,
        owner=_owner_out(r.owner, with_contact=False),
    )
    if not detail:
        return out

    signed_in = bool(viewer and viewer.verified)
    access = _access(r, viewer, db)
    out.access = access
    out.owner = _owner_out(r.owner, with_contact=signed_in)
    out.upi_id = r.upi_id if signed_in else None
    if access.full:
        out.drive_url = r.drive_url
        out.file_url = f"{base}api/resources/{r.id}/file" if r.file_name else None
    if access.reason in ("owner", "admin"):
        out.pending_requests = (
            db.query(ResourceAccess)
            .filter(ResourceAccess.resource_id == r.id, ResourceAccess.status == "pending")
            .count()
        )
    return out


# ---------- helpers ----------


def _form_fields(
    title: str = Form(""),
    subject: str = Form(""),
    year: str = Form("any"),
    copy_type: str = Form(""),
    offer_type: str = Form(""),
    price: str = Form(""),
    description: Optional[str] = Form(None),
    delivery: Optional[str] = Form(None),
    drive_url: Optional[str] = Form(None),
    pickup_spot: Optional[str] = Form(None),
    upi_id: Optional[str] = Form(None),
) -> ResourceIn:
    raw = {
        "title": title,
        "subject": subject,
        "year": year or "any",
        "copy_type": copy_type,
        "offer_type": offer_type,
        "price": price,
        "description": description,
        "delivery": delivery or None,
        "drive_url": drive_url,
        "pickup_spot": pickup_spot,
        "upi_id": upi_id,
    }
    try:
        return ResourceIn.model_validate(raw)
    except ValidationError as e:
        raise RequestValidationError(e.errors(include_url=False, include_context=False))


def _get_resource(resource_id: int, db: Session) -> Resource:
    r = db.query(Resource).options(joinedload(Resource.owner)).filter(Resource.id == resource_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resource not found")
    return r


def _get_owned_resource(resource_id: int, db: Session, user: User, allow_admin: bool = False) -> Resource:
    r = _get_resource(resource_id, db)
    if r.owner_id != user.id and not (allow_admin and user.is_admin):
        raise HTTPException(status_code=403, detail="You don't own this resource")
    return r


# ---------- routes ----------


@router.get("", response_model=ResourceListOut)
def list_resources(
    request: Request,
    q: Optional[str] = None,
    subject: Optional[str] = None,
    year: Optional[str] = None,
    copy_type: Optional[str] = None,
    offer_type: Optional[str] = None,
    sort: str = "newest",
    mine: bool = False,
    db: Session = Depends(get_db),
    viewer: User = Depends(require_verified),  # the Resource Hub is for verified students only
):
    query = db.query(Resource).options(joinedload(Resource.owner))

    if mine:
        query = query.filter(Resource.owner_id == viewer.id)
    else:
        query = query.filter(Resource.status == "available")

    if q and q.strip():
        like = f"%{q.strip()}%"
        query = query.filter(or_(Resource.title.ilike(like), Resource.subject.ilike(like), Resource.description.ilike(like)))
    if subject and subject.strip():
        query = query.filter(func.lower(Resource.subject) == subject.strip().lower())
    if year in ("1", "2", "3", "4"):
        # "Any year" material is relevant to every year.
        query = query.filter(Resource.year.in_([year, "any"]))
    if copy_type in ("soft", "hard"):
        query = query.filter(Resource.copy_type == copy_type)
    if offer_type in ("sale", "free"):
        query = query.filter(Resource.offer_type == offer_type)

    if sort == "price_low":
        query = query.order_by(Resource.price.asc(), Resource.created_at.desc())
    elif sort == "price_high":
        query = query.order_by(Resource.price.desc(), Resource.created_at.desc())
    else:
        query = query.order_by(Resource.created_at.desc(), Resource.id.desc())

    items = query.all()
    return ResourceListOut(items=[_resource_out(r, request) for r in items], total=len(items))


@router.get("/facets", response_model=FacetsOut)
def resource_facets(db: Session = Depends(get_db), _viewer: User = Depends(require_verified)):
    """Subjects for the filter dropdown and the form's autocomplete: the standard list first,
    then any other subjects that available resources use."""
    rows = db.query(Resource.subject).filter(Resource.status == "available").distinct().all()
    standard = {s.lower() for s in SUBJECTS}
    extra: dict[str, str] = {}
    for (subject,) in rows:
        if subject.lower() not in standard:
            extra.setdefault(subject.lower(), subject)
    return FacetsOut(subjects=[*SUBJECTS, *sorted(extra.values(), key=str.lower)])


@router.get("/recommended", response_model=ResourceRecommendedOut)
def recommended_resources(
    request: Request,
    subject_scores: Optional[str] = None,  # JSON like {"DSA": 2.5}, built by the frontend from views
    year: Optional[str] = None,  # viewer's year of study, "1".."4"
    exclude_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _viewer: User = Depends(require_verified),
):
    """Same idea as /api/listings/recommended: subject affinity from what the student opened,
    plus a small boost for material from their year of study. Newest first on ties."""
    scores: dict[str, float] = {}
    if subject_scores:
        try:
            parsed = json.loads(subject_scores)
            if isinstance(parsed, dict):
                scores = {str(k).lower(): float(v) for k, v in parsed.items()}
        except (ValueError, TypeError):
            scores = {}  # malformed input just means "no personalization"

    query = db.query(Resource).options(joinedload(Resource.owner)).filter(Resource.status == "available")
    if exclude_id:
        query = query.filter(Resource.id != exclude_id)
    pool = query.order_by(Resource.created_at.desc(), Resource.id.desc()).all()

    def score(r: Resource) -> float:
        s = scores.get(r.subject.lower(), 0.0)
        if year in ("1", "2", "3", "4") and r.year == year:
            s += 0.5
        return s

    ranked = sorted(pool, key=score, reverse=True)[:8]  # stable: ties stay newest-first
    return ResourceRecommendedOut(
        items=[_resource_out(r, request) for r in ranked],
        personalized=bool(scores),
    )


@router.get("/{resource_id}", response_model=ResourceOut)
def get_resource(
    resource_id: int,
    request: Request,
    db: Session = Depends(get_db),
    viewer: User = Depends(require_verified),  # the Resource Hub is for verified students only
):
    return _resource_out(_get_resource(resource_id, db), request, viewer, db, detail=True)


@router.post("", response_model=ResourceOut, status_code=201)
def create_resource(
    request: Request,
    fields: ResourceIn = Depends(_form_fields),
    file: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    if not user.profile_completed:
        raise HTTPException(status_code=403, detail="Complete your profile before posting a resource")
    if not user.phone:
        raise HTTPException(status_code=403, detail="Add your WhatsApp number in your profile so buyers can contact you")
    pdf = _read_pdf(file)
    _check_file_rules(fields, has_file=pdf is not None)

    r = Resource(**fields.model_dump(), owner_id=user.id, status="available", preview_pages=[])
    written: StoredFiles = []
    try:
        if pdf:
            _store_pdf(r, pdf, written)
        db.add(r)
        db.commit()
    except Exception:
        db.rollback()
        _remove_files(written)
        raise
    finally:
        if pdf:
            pdf.doc.close()
    return _resource_out(_get_resource(r.id, db), request, user, db, detail=True)


@router.put("/{resource_id}", response_model=ResourceOut)
def update_resource(
    resource_id: int,
    request: Request,
    fields: ResourceIn = Depends(_form_fields),
    file: UploadFile | None = File(None),
    remove_file: bool = Form(False),
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    r = _get_owned_resource(resource_id, db, user)
    pdf = _read_pdf(file)
    keeps_file = bool(r.file_name) and not remove_file
    _check_file_rules(fields, has_file=pdf is not None or keeps_file)

    had_partial = any(p["kind"] == "partial" for p in (r.preview_pages or []))
    written: StoredFiles = []
    stale: StoredFiles = []
    try:
        for key, value in fields.model_dump().items():
            setattr(r, key, value)

        if pdf:
            stale = _resource_files(r)
            _store_pdf(r, pdf, written)
        elif remove_file and r.file_name:
            stale = _resource_files(r)
            _clear_file(r)
        elif r.file_name and r.page_count == 1 and had_partial != _wants_half_blur(r):
            # Offer or delivery changed on a one-page PDF: re-render so the preview matches.
            data = storage.get_private(_pdf_key(r))
            if data:
                doc = open_pdf(data)
                try:
                    stale = [f for f in _resource_files(r) if f[0] == "public"]
                    _write_previews(r, doc, written)
                finally:
                    doc.close()
        r.updated_at = datetime.utcnow()
        db.commit()
    except Exception:
        db.rollback()
        _remove_files(written)
        raise
    finally:
        if pdf:
            pdf.doc.close()

    _remove_files(stale)
    return _resource_out(_get_resource(r.id, db), request, user, db, detail=True)


@router.patch("/{resource_id}/status", response_model=ResourceOut)
def set_resource_status(
    resource_id: int,
    payload: StatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    r = _get_owned_resource(resource_id, db, user)
    r.status = payload.status
    db.commit()
    return _resource_out(_get_resource(r.id, db), request, user, db, detail=True)


@router.delete("/{resource_id}", status_code=204)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _get_owned_resource(resource_id, db, user, allow_admin=True)
    files = _resource_files(r)
    db.delete(r)
    db.commit()
    _remove_files(files)


@router.post("/{resource_id}/access", response_model=AccessRequestOut, status_code=201)
def request_access(
    resource_id: int,
    payload: AccessRequestIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _get_resource(resource_id, db)
    if not user.verified:
        raise HTTPException(status_code=403, detail="Verify your college email first")
    if r.owner_id == user.id:
        raise HTTPException(status_code=400, detail="This is your own resource")
    if r.offer_type == "free":
        raise HTTPException(status_code=400, detail="This resource is free, no request needed")
    if r.status == "closed":
        raise HTTPException(status_code=400, detail="The owner has closed this resource")

    req = (
        db.query(ResourceAccess)
        .filter(ResourceAccess.resource_id == r.id, ResourceAccess.user_id == user.id)
        .first()
    )
    if req and req.status == "approved":
        raise HTTPException(status_code=409, detail="You already have access")
    if req and req.status == "pending":
        raise HTTPException(status_code=409, detail="Your request is already waiting for the owner")

    now = datetime.utcnow()
    if req:  # re-request after a denial
        req.status = "pending"
        req.note = payload.note
        req.decided_at = None
        req.updated_at = now
    else:
        req = ResourceAccess(resource_id=r.id, user_id=user.id, status="pending", note=payload.note)
        db.add(req)
    notify(
        db,
        recipient_id=r.owner_id,
        actor=user,
        type="access_request",
        target_type="resource",
        target_id=r.id,
        target_title=r.title,
        note=payload.note,
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Your request is already waiting for the owner")
    db.refresh(req)
    return _request_out(req)


@router.get("/{resource_id}/access", response_model=list[AccessRequestOut])
def list_access_requests(
    resource_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _get_owned_resource(resource_id, db, user, allow_admin=True)
    rows = (
        db.query(ResourceAccess)
        .options(joinedload(ResourceAccess.user))
        .filter(ResourceAccess.resource_id == r.id)
        .all()
    )
    order = {"pending": 0, "approved": 1, "denied": 2}
    rows.sort(key=lambda a: (order.get(a.status, 3), -a.updated_at.timestamp()))
    return [_request_out(a, with_requester=True) for a in rows]


@router.patch("/{resource_id}/access/{request_id}", response_model=AccessRequestOut)
def decide_access_request(
    resource_id: int,
    request_id: int,
    payload: AccessDecision,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _get_owned_resource(resource_id, db, user, allow_admin=True)
    req = (
        db.query(ResourceAccess)
        .filter(ResourceAccess.id == request_id, ResourceAccess.resource_id == r.id)
        .first()
    )
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    now = datetime.utcnow()
    req.status = payload.status
    req.decided_at = now
    req.updated_at = now
    db.commit()
    db.refresh(req)
    return _request_out(req, with_requester=True)


@router.get("/{resource_id}/file")
def download_resource_file(
    resource_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    r = _get_resource(resource_id, db)
    if not _access(r, user, db).full:
        raise HTTPException(status_code=403, detail="You don't have access to this file yet")
    key = _pdf_key(r)
    data = storage.get_private(key) if key else None
    if not data:
        raise HTTPException(status_code=404, detail="This resource has no file")
    slug = re.sub(r"[^A-Za-z0-9]+", "-", r.title).strip("-")[:60] or "resource"
    return Response(
        content=data,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{slug}.pdf"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
