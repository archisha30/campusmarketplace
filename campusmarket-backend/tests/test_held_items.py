"""Admins hear about reports in-app (never by email), and a pile-up of reports holds the item."""

import pytest

from app.core.moderation import HOLD_AFTER_REPORTS
from app.models.listing import Listing
from app.core.security import create_access_token
from conftest import _user


@pytest.fixture
def reporters(db_session, users):
    """HOLD_AFTER_REPORTS different students (one report per student per item)."""
    db, _ = db_session
    return [_user(db, f"student{i}@campus.edu") for i in range(HOLD_AFTER_REPORTS)]


@pytest.fixture
def lamp(db_session, users):
    db, _ = db_session
    l = Listing(owner_id=users["owner"].id, title="Bright study lamp", category="Dorm Essentials", listing_type="sale",
                price=300, condition="Good", description="LED lamp", pickup_spot="Gate", images=[])
    db.add(l)
    db.commit()
    return l.id


def as_user(u):
    return {"Authorization": f"Bearer {create_access_token(u.id)}"}


def report(client, headers, lid=None, rid=None, reason="Incorrect information"):
    body = {"reason": reason, **({"listing_id": lid} if lid else {"resource_id": rid})}
    res = client.post("/api/reports", json=body, headers=headers)
    assert res.status_code == 201, res.text


def hold(client, reporters, **target):
    for u in reporters:
        report(client, as_user(u), **target)


def summary(client, auth, who="admin"):
    return client.get("/api/admin/reports/summary", headers=auth(who))


def test_summary_counts_and_is_admin_only(client, auth, lamp, reporters, db_session, users):
    assert summary(client, auth, "buyer").status_code == 403
    assert summary(client, auth, "owner").status_code == 403  # owner here is a seller, not an admin
    assert client.get("/api/admin/reports/summary").status_code == 401
    assert summary(client, auth).json() == {"open": 0, "serious_open": 0, "held": 0}

    db, _ = db_session
    other = Listing(owner_id=users["owner"].id, title="Kettle", category="Dorm Essentials", listing_type="sale",
                    price=200, condition="Good", description="Works", pickup_spot="Gate", images=[])
    db.add(other)
    db.commit()
    report(client, auth("buyer"), lid=other.id, reason="Scam / suspicious")
    report(client, auth("other"), lid=other.id, reason="Spam")
    hold(client, reporters, lid=lamp)
    assert summary(client, auth).json() == {"open": 5, "serious_open": 1, "held": 1}


def test_reports_never_send_email(client, auth, lamp, reporters, no_real_email):
    report(client, auth("buyer"), lid=lamp, reason="Scam / suspicious")
    report(client, auth("other"), lid=lamp, reason="Prohibited item")
    hold(client, reporters[:HOLD_AFTER_REPORTS - 2], lid=lamp)  # the third one holds the item
    assert client.get("/api/admin/reports/summary", headers=auth("admin")).json()["held"] == 1
    assert no_real_email == []
    # Once held it's hidden, so nobody else can report it until it's reviewed.
    assert client.post("/api/reports", json={"listing_id": lamp, "reason": "Spam"}, headers=as_user(reporters[-1])).status_code == 404


def test_pile_up_holds_the_listing_everywhere(client, auth, lamp, reporters):
    client.put(f"/api/wishlist/{lamp}", headers=auth("buyer"))
    hold(client, reporters[:HOLD_AFTER_REPORTS - 1], lid=lamp)
    assert client.get(f"/api/listings/{lamp}", headers=auth("buyer")).status_code == 200  # 2 reports: still up
    hold(client, reporters[HOLD_AFTER_REPORTS - 1:], lid=lamp)

    ids = lambda res: [l["id"] for l in res.json()["items"]]  # noqa: E731
    assert lamp not in ids(client.get("/api/listings", headers=auth("buyer")))
    assert lamp not in ids(client.get("/api/listings", params={"q": "lamp"}, headers=auth("buyer")))
    assert lamp not in ids(client.get("/api/listings/recommended", headers=auth("buyer")))
    assert client.get(f"/api/listings/{lamp}", headers=auth("buyer")).status_code == 404
    assert client.get("/api/wishlist", headers=auth("buyer")).json() == []
    assert client.put(f"/api/wishlist/{lamp}", headers=auth("other")).status_code == 404
    res = client.post("/api/contact", json={"target_type": "listing", "target_id": lamp, "channel": "whatsapp"}, headers=auth("buyer"))
    assert res.status_code == 404


def test_owner_and_admins_still_see_it(client, auth, lamp, reporters, users):
    hold(client, reporters, lid=lamp)
    for who in ("owner", "admin"):
        res = client.get(f"/api/listings/{lamp}", headers=auth(who))
        assert res.status_code == 200 and res.json()["held"] is True
    mine = client.get("/api/listings", params={"seller_id": str(users["owner"].id)}, headers=auth("owner")).json()
    assert [(l["id"], l["held"]) for l in mine["items"]] == [(lamp, True)]  # Seller Dashboard
    assert client.get("/api/admin/listings", headers=auth("admin")).json()["items"][0]["held"] is True
    # The owner can still fix it.
    assert client.put(f"/api/listings/{lamp}", json={"description": "LED lamp, 3 brightness levels"}, headers=auth("owner")).status_code == 200


def test_seller_is_told_why_not_who(client, auth, lamp, reporters):
    hold(client, reporters, lid=lamp)
    held = [n for n in client.get("/api/notifications", headers=auth("owner")).json()["items"] if n["type"] == "held"]
    assert len(held) == 1
    assert held[0]["note"] == "Incorrect information" and held[0]["actor"]["name"] == "CampusMarket team"
    assert held[0]["actor"]["email"] == "" and held[0]["actor"]["id"] == ""


def test_held_items_come_first_for_admins(client, auth, lamp, reporters, db_session, users):
    db, _ = db_session
    newer = Listing(owner_id=users["owner"].id, title="Kettle", category="Dorm Essentials", listing_type="sale",
                    price=200, condition="Good", description="Works", pickup_spot="Gate", images=[])
    db.add(newer)
    db.commit()
    hold(client, reporters, lid=lamp)
    report(client, auth("buyer"), lid=newer.id)  # newest report, but its item isn't held
    items = client.get("/api/admin/reports", headers=auth("admin")).json()["items"]
    assert [r["target_id"] for r in items[:HOLD_AFTER_REPORTS]] == [lamp] * HOLD_AFTER_REPORTS
    assert items[0]["target_held"] is True and items[-1]["target_held"] is False


def test_resolving_lifts_the_hold(client, auth, lamp, reporters):
    hold(client, reporters, lid=lamp)
    for r in client.get("/api/admin/reports", headers=auth("admin")).json()["items"]:
        assert client.patch(f"/api/admin/reports/{r['id']}", json={"status": "resolved"}, headers=auth("admin")).status_code == 204
    res = client.get(f"/api/listings/{lamp}", headers=auth("buyer"))
    assert res.status_code == 200 and res.json()["held"] is False
    assert summary(client, auth).json()["held"] == 0
    assert client.get("/api/notifications", headers=auth("owner")).json()["items"][0]["type"] == "report_cleared"


def test_removing_a_held_item_still_works(client, auth, lamp, reporters):
    hold(client, reporters, lid=lamp)
    res = client.post(f"/api/admin/listings/{lamp}/remove", json={"reason": "Scam bait"}, headers=auth("admin"))
    assert res.status_code == 204
    assert summary(client, auth).json() == {"open": 0, "serious_open": 0, "held": 0}


def test_resources_are_held_too(client, auth, create, reporters):
    rid = create().json()["id"]
    hold(client, reporters, rid=rid)
    hub = client.get("/api/resources", headers=auth("buyer")).json()["items"]
    assert rid not in [r["id"] for r in hub]
    assert rid not in [r["id"] for r in client.get("/api/resources/recommended", headers=auth("buyer")).json()["items"]]
    assert client.get(f"/api/resources/{rid}", headers=auth("buyer")).status_code == 404
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).status_code == 404
    res = client.get(f"/api/resources/{rid}", headers=auth("owner"))
    assert res.status_code == 200 and res.json()["held"] is True
    assert [r["held"] for r in client.get("/api/resources", params={"mine": True}, headers=auth("owner")).json()["items"]] == [True]
    assert client.get(f"/api/resources/{rid}", headers=auth("admin")).status_code == 200
