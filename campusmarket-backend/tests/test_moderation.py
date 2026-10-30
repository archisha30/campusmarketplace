"""What sellers hear about reports and admin removals (core/moderation.py)."""

import pytest

from app.core import moderation
from app.models.listing import Listing


@pytest.fixture
def listing_id(db_session, users):
    db, _ = db_session
    l = Listing(owner_id=users["owner"].id, title="iPhone 15 for ₹999", category="Electronics", listing_type="sale",
                price=999, condition="New", pickup_spot="Gate", images=[])
    db.add(l)
    db.commit()
    return l.id


def report(client, auth, lid, who="buyer", reason="Incorrect information"):
    return client.post("/api/reports", json={"listing_id": lid, "reason": reason}, headers=auth(who))


def notes(client, auth):
    return client.get("/api/notifications", headers=auth("owner")).json()["items"]


def open_reports(client, auth):
    return client.get("/api/admin/reports", params={"status": "open"}, headers=auth("admin")).json()["items"]


def test_serious_reports_wait_for_an_admin(client, auth, listing_id):
    assert report(client, auth, listing_id, reason="Scam / suspicious").status_code == 201
    assert notes(client, auth) == []  # not tipped off yet
    assert len(open_reports(client, auth)) == 1  # but admins see it


def test_repeat_reports_update_one_notification(client, auth, listing_id):
    report(client, auth, listing_id, reason="Spam")
    report(client, auth, listing_id, who="other")
    (n,) = notes(client, auth)
    assert n["type"] == "report" and n["count"] == 2 and n["note"] == "Incorrect information"
    # Once read, a later report starts a new one.
    client.post("/api/notifications/read-all", headers=auth("owner"))
    report(client, auth, listing_id, who="admin", reason="Spam")
    # (The third report also holds the item, which is its own notification: test_held_items.py.)
    assert [x["count"] for x in notes(client, auth) if x["type"] == "report"] == [3, 2]


def test_clearing_the_last_report_tells_the_seller(client, auth, listing_id):
    report(client, auth, listing_id)
    report(client, auth, listing_id, who="other", reason="Scam / suspicious")
    first, second = open_reports(client, auth)
    client.patch(f"/api/admin/reports/{first['id']}", json={"status": "resolved"}, headers=auth("admin"))
    assert [n["type"] for n in notes(client, auth)] == ["report"]  # one still open
    client.patch(f"/api/admin/reports/{second['id']}", json={"status": "resolved"}, headers=auth("admin"))
    cleared = notes(client, auth)[0]
    assert cleared["type"] == "report_cleared" and cleared["target_id"] == listing_id
    assert cleared["actor"]["name"] == "CampusMarket team"  # not the admin's name


def test_removal_tells_the_seller_why(client, auth, listing_id):
    report(client, auth, listing_id, reason="Scam / suspicious")
    res = client.post(f"/api/admin/listings/{listing_id}/remove",
                      json={"reason": "Price is a scam bait; real phones aren't ₹999"}, headers=auth("admin"))
    assert res.status_code == 204
    (n,) = notes(client, auth)
    assert n["type"] == "removed" and n["note"] == "Price is a scam bait; real phones aren't ₹999"
    assert n["target_title"] == "iPhone 15 for ₹999" and n["actor"]["name"] == "CampusMarket team"
    assert open_reports(client, auth) == []  # its reports are resolved
    assert client.get(f"/api/listings/{listing_id}", headers=auth("buyer")).status_code == 404


def test_reports_per_day_limit(client, auth, db_session, users, monkeypatch):
    monkeypatch.setattr(moderation, "REPORTS_PER_DAY", 2)
    from app.api.routes import reports as reports_routes
    monkeypatch.setattr(reports_routes, "REPORTS_PER_DAY", 2)
    db, _ = db_session
    ids = []
    for i in range(3):
        l = Listing(owner_id=users["owner"].id, title=f"Item {i}", category="Electronics", listing_type="sale",
                    price=10, condition="Good", pickup_spot="Gate", images=[])
        db.add(l)
        db.commit()
        ids.append(l.id)
    assert [report(client, auth, i).status_code for i in ids] == [201, 201, 429]
