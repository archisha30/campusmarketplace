"""Looking For requests and items for sale find each other, for listings and resources alike.

Posting a request shows matching items already up (best_matches), and a new item notifies
students whose open request it matches (notify_matching_requests). Uses the marketplace search
(core/search.py), loosened so one word of a longer request may miss (see hits_needed).
"""

from sqlalchemy import case
from sqlalchemy.orm import Session

from app.api.routes.notifications import notify
from app.core.search import expand, groups_found, hits_needed, relevance, search_filter, title_vocabulary
from app.core.timeutil import utcnow
from app.core.trash import live
from app.models.product_request import VISIBLE_FOR, ProductRequest
from app.models.user import User

VOCABULARY_TITLES = 5000  # recent titles whose words count as "known" when fixing typos


def best_matches(db: Session, model, text: str, filters=(), exclude_owner_id=None, limit: int = 4) -> list:
    """Live `model` items (Listing or Resource) matching `text`, best match first. `filters`
    narrow it further, e.g. to items still for sale."""
    if not text or not text.strip():
        return []
    titles = (t for (t,) in db.query(model.title).filter(live(model)).order_by(model.created_at.desc()).limit(VOCABULARY_TITLES))
    groups = expand(text[:100], title_vocabulary(titles))
    if not groups:
        return []
    hits = sum(case((match, 1), else_=0) for match in search_filter(model, groups))
    query = db.query(model).filter(live(model), *filters, hits >= hits_needed(len(groups)))
    if exclude_owner_id is not None:
        query = query.filter(model.owner_id != exclude_owner_id)
    order = (hits.desc(), relevance(model, groups, text).desc(), model.created_at.desc())
    return query.order_by(*order).limit(limit).all()


def notify_matching_requests(db: Session, *, seller: User, target_type: str, target_id: int, title: str, fields) -> None:
    """Tell students whose open request matches a new item (the caller commits). `fields` are
    the item's title, description and category/subject. One notification per student, even if
    several of their requests match."""
    vocabulary = title_vocabulary([title])
    open_requests = (
        db.query(ProductRequest)
        .filter(
            ProductRequest.created_at >= utcnow() - VISIBLE_FOR,
            ProductRequest.user_id != seller.id,
            ProductRequest.user.has(User.suspended_at.is_(None)),
        )
        .order_by(ProductRequest.created_at.desc())
        .all()
    )
    told = set()
    for req in open_requests:
        if req.user_id in told:
            continue
        groups = expand(req.product[:100], vocabulary)
        if groups and groups_found(fields, groups) >= hits_needed(len(groups)):
            notify(db, recipient_id=req.user_id, actor=seller, type="request_match",
                   target_type=target_type, target_id=target_id, target_title=title, note=req.product)
            told.add(req.user_id)
