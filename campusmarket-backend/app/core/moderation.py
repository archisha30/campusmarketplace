"""What sellers hear about reports and admin removals.

  * A report notifies the seller anonymously, except SERIOUS_REASONS, which wait for an
    admin: a scammer shouldn't be tipped off before anyone has looked.
  * Repeat reports on one item update a single unread notification ("reported 3 times").
  * When an admin clears the last open report on an item, the seller hears it stays up.
  * When an admin removes an item, the seller hears why (the admin must give a reason).
"""

from sqlalchemy.orm import Session

from app.api.routes.notifications import notify
from app.core.timeutil import utcnow
from app.models.notification import Notification
from app.models.report import Report
from app.models.user import User

# Must match the values in REPORT_REASONS (schemas/report.py).
SERIOUS_REASONS = {"Scam / suspicious", "Prohibited item"}
REPORTS_PER_DAY = 10  # per student, so nobody can flood a seller or the admin queue


def _open_reports(db: Session, target_type: str, target_id: int):
    return db.query(Report).filter(
        Report.target_type == target_type, Report.target_id == target_id, Report.status == "open"
    )


def notify_report(db: Session, report: Report, reporter: User) -> None:
    """Tell the seller about a new report now, unless its reason has to wait for an admin."""
    report.owner_notified = report.reason not in SERIOUS_REASONS
    if not report.owner_notified:
        return
    db.flush()
    told = _open_reports(db, report.target_type, report.target_id).filter(Report.owner_notified.is_(True)).count()
    existing = (
        db.query(Notification)
        .filter(
            Notification.user_id == report.owner_id,
            Notification.type == "report",
            Notification.target_type == report.target_type,
            Notification.target_id == report.target_id,
            Notification.read_at.is_(None),
        )
        .first()
    )
    if existing:  # still unread: update it instead of adding another
        existing.count = max(told, existing.count + 1)
        existing.note = report.reason
        existing.actor_id = reporter.id
        existing.created_at = utcnow()
        return
    n = notify(
        db, recipient_id=report.owner_id, actor=reporter, type="report",
        target_type=report.target_type, target_id=report.target_id, target_title=report.target_title,
        note=report.reason,
    )
    if n:
        n.count = max(told, 1)


def reports_cleared(db: Session, report: Report, admin: User) -> None:
    """After an admin resolves a report: if none are left open on the item, tell the seller
    it was reviewed and stays up."""
    db.flush()
    if _open_reports(db, report.target_type, report.target_id).count():
        return
    notify(
        db, recipient_id=report.owner_id, actor=admin, type="report_cleared",
        target_type=report.target_type, target_id=report.target_id, target_title=report.target_title,
    )


def item_removed(db: Session, *, owner_id, target_type: str, target_id: int, title: str, reason: str, admin: User) -> None:
    """An admin removed the item: resolve its open reports and tell the seller why."""
    _open_reports(db, target_type, target_id).update(
        {Report.status: "resolved", Report.resolved_at: utcnow()}, synchronize_session=False
    )
    notify(
        db, recipient_id=owner_id, actor=admin, type="removed",
        target_type=target_type, target_id=target_id, target_title=title, note=reason,
    )
