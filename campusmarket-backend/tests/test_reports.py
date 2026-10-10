"""Reporting a listing/resource: seller notified anonymously, admins see everything."""

import pytest

from app.core.config import settings
from app.models.listing import Listing


@pytest.fixture
def listing_id(db_session, users):
    db, _ = db_session
    listing = Listing(
        owner_id=users["owner"].id, title="Too-good-to-be-true iPhone", category="Electronics", listing_type="sale",
        price=999, condition="New", pickup_spot="Gate", images=[],
    )
    db.add(listing)
    db.commit()
    return listing.id


def report(client, auth, who="buyer", **body):
    body.setdefault("reason", "Scam / suspicious")
    return client.post("/api/reports", json=body, headers=auth(who))


def test_report_notifies_seller_anonymously(client, auth, listing_id):
    res = report(client, auth, listing_id=listing_id, details="Asked me to pay before meeting")
    assert res.status_code == 201, res.text

    notes = client.get("/api/notifications", headers=auth("owner")).json()
    n = notes["items"][0]
    assert notes["unread"] == 1
    assert n["type"] == "report" and n["note"] == "Scam / suspicious"
    assert n["target_type"] == "listing" and n["target_id"] == listing_id
    assert n["target_title"] == "Too-good-to-be-true iPhone"
    # The seller must not learn who reported them.
    assert n["actor"] == {"id": "", "name": "A student", "avatar_url": None, "email": "", "phone": None}


def test_resource_reports_work_too(client, auth, create):
    rid = create().json()["id"]
    assert report(client, auth, resource_id=rid, reason="Incorrect information").status_code == 201
    n = client.get("/api/notifications", headers=auth("owner")).json()["items"][0]
    assert n["type"] == "report" and n["target_type"] == "resource" and n["note"] == "Incorrect information"


def test_one_report_per_person_per_item(client, auth, listing_id):
    assert report(client, auth, listing_id=listing_id).status_code == 201
    again = report(client, auth, listing_id=listing_id, reason="Spam")
    assert again.status_code == 409 and "already reported" in again.json()["detail"]
    # A different student can still report it.
    assert report(client, auth, who="other", listing_id=listing_id).status_code == 201
    assert client.get("/api/notifications", headers=auth("owner")).json()["unread"] == 2


def test_report_validation(client, auth, listing_id):
    assert report(client, auth, who="owner", listing_id=listing_id).status_code == 400  # own item
    assert report(client, auth, listing_id=999).status_code == 404
    assert report(client, auth, listing_id=listing_id, reason="I don't like it").status_code == 422
    assert report(client, auth).status_code == 422  # no target
    assert report(client, auth, listing_id=listing_id, resource_id=1).status_code == 422  # two targets
    assert report(client, auth, who="unverified", listing_id=listing_id).status_code == 403
    assert client.post("/api/reports", json={"listing_id": listing_id, "reason": "Spam"}).status_code in (401, 403)


def test_admins_see_reporter_and_resolve(client, auth, listing_id, monkeypatch):
    monkeypatch.setattr(settings, "OWNER_EMAILS", [])
    report(client, auth, listing_id=listing_id, details="Asked for advance payment")
    report(client, auth, who="other", listing_id=listing_id, reason="Spam")

    assert client.get("/api/admin/reports", headers=auth("buyer")).status_code == 403
    data = client.get("/api/admin/reports", headers=auth("admin")).json()
    assert data["open"] == 2
    first = data["items"][-1]
    assert first["reporter"]["email"] == "buyer@campus.edu"
    assert first["owner"]["email"] == "owner@campus.edu"
    assert first["details"] == "Asked for advance payment"
    assert first["reports_on_item"] == 2 and first["target_exists"] is True

    assert client.patch(f"/api/admin/reports/{first['id']}", json={"status": "resolved"}, headers=auth("admin")).status_code == 204
    assert client.get("/api/admin/reports", headers=auth("admin")).json()["open"] == 1
    open_only = client.get("/api/admin/reports", params={"status": "open"}, headers=auth("admin")).json()["items"]
    assert [r["reason"] for r in open_only] == ["Spam"]

    # Deleting the item keeps the report history, flagged as gone.
    client.delete(f"/api/admin/listings/{listing_id}", headers=auth("admin"))
    assert all(r["target_exists"] is False for r in client.get("/api/admin/reports", headers=auth("admin")).json()["items"])
