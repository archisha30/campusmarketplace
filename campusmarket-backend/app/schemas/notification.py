from datetime import datetime

from pydantic import BaseModel


class ActorOut(BaseModel):
    id: str
    name: str
    avatar_url: str | None = None
    # The actor reached out first, so the recipient can reply to them directly.
    email: str
    phone: str | None = None


class NotificationOut(BaseModel):
    id: int
    # access_request | access_approved | access_denied | contact | report | removed | report_cleared | held
    type: str
    channel: str | None = None
    target_type: str
    target_id: int
    target_title: str
    note: str | None = None
    count: int = 1  # "report": how many reports this one notification stands for
    created_at: datetime
    read: bool
    actor: ActorOut

    @classmethod
    def from_model(cls, n) -> "NotificationOut":
        return cls(
            id=n.id,
            type=n.type,
            channel=n.channel,
            target_type=n.target_type,
            target_id=n.target_id,
            target_title=n.target_title,
            note=n.note,
            count=n.count or 1,
            created_at=n.created_at,
            read=n.read_at is not None,
            actor=_actor_out(n),
        )


# Sent by the team, so they never show the admin who acted.
TEAM_TYPES = ("removed", "report_cleared", "held")
# The owner answering a buyer: name and photo only. Contact details go through /api/contact.
NO_CONTACT_TYPES = ("access_approved", "access_denied")


def _actor_out(n) -> ActorOut:
    a = n.actor
    if n.type == "report":
        # Reports are anonymous to the seller, so people aren't afraid to flag things.
        return ActorOut(id="", name="A student", email="")
    if n.type in TEAM_TYPES:
        return ActorOut(id="", name="CampusMarket team", email="")
    name = a.name or a.email.split("@")[0]
    if n.type in NO_CONTACT_TYPES:
        return ActorOut(id=str(a.id), name=name, avatar_url=a.avatar_url, email="")
    return ActorOut(id=str(a.id), name=name, avatar_url=a.avatar_url, email=a.email, phone=a.phone)


class NotificationListOut(BaseModel):
    items: list[NotificationOut]
    unread: int
