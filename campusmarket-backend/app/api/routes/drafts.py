"""Saved drafts for the Sell and Post a Resource forms (Seller Dashboard → Drafts tab).

Drafts live on the server so a student can start on their phone and finish on a laptop.
Publishing goes through the normal create endpoints; the frontend deletes the draft after.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_seller
from app.db.session import get_db
from app.models.draft import Draft
from app.models.user import User
from app.schemas.draft import DraftIn, DraftOut

router = APIRouter(prefix="/api/drafts", tags=["drafts"])

MAX_DRAFTS = 20


def _own_draft(db: Session, draft_id: int, user: User) -> Draft:
    draft = db.query(Draft).filter(Draft.id == draft_id, Draft.user_id == user.id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found. It may have been published or deleted.")
    return draft


@router.get("", response_model=list[DraftOut])
def list_drafts(
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    rows = (
        db.query(Draft)
        .filter(Draft.user_id == user.id)
        .order_by(Draft.updated_at.desc(), Draft.id.desc())
        .all()
    )
    return [DraftOut.from_model(d) for d in rows]


@router.get("/{draft_id}", response_model=DraftOut)
def get_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    return DraftOut.from_model(_own_draft(db, draft_id, user))


@router.post("", response_model=DraftOut, status_code=201)
def create_draft(
    payload: DraftIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    if db.query(Draft).filter(Draft.user_id == user.id).count() >= MAX_DRAFTS:
        raise HTTPException(
            status_code=409,
            detail=f"You can keep up to {MAX_DRAFTS} drafts. Publish or delete one from the Drafts tab first.",
        )
    now = datetime.utcnow()
    draft = Draft(user_id=user.id, kind=payload.kind, data=payload.clean_data(), created_at=now, updated_at=now)
    db.add(draft)
    db.commit()
    db.refresh(draft)
    return DraftOut.from_model(draft)


@router.put("/{draft_id}", response_model=DraftOut)
def update_draft(
    draft_id: int,
    payload: DraftIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    draft = _own_draft(db, draft_id, user)
    if payload.kind != draft.kind:
        raise HTTPException(status_code=422, detail="A listing draft can't become a resource draft, or the other way round.")
    draft.data = payload.clean_data()
    draft.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(draft)
    return DraftOut.from_model(draft)


@router.delete("/{draft_id}", status_code=204)
def delete_draft(
    draft_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_seller),
):
    db.delete(_own_draft(db, draft_id, user))
    db.commit()
