"""Owner notifications: access requests and WhatsApp / Email contact taps."""

import pytest

from app.models.listing import Listing


def _notes(client, auth, who):
    res = client.get("/api/notifications", headers=auth(who))
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
def resource_id(create):
    res = create()
    assert res.status_code == 201, res.text
    return res.json()["id"]


@pytest.fixture
def listing_id(db_session, users):
    db, _ = db_session
    listing = Listing(
        owner_id=users["owner"].id, title="boAt Airdopes", category="Electronics", listing_type="sale",
        price=900, condition="Good", pickup_spot="Library", images=[],
    )
    db.add(listing)
    db.commit()
    return listing.id


def test_access_request_notifies_owner(client, auth, resource_id):
    client.post(f"/api/resources/{resource_id}/access", json={"note": "Paid via UPI"}, headers=auth("buyer"))

    data = _notes(client, auth, "owner")
    assert data["unread"] == 1
    n = data["items"][0]
    assert n["type"] == "access_request"
    assert n["target_type"] == "resource" and n["target_id"] == resource_id
    assert n["target_title"] == "DBMS handwritten notes"
    assert n["note"] == "Paid via UPI"
    assert n["read"] is False
    assert n["actor"]["email"] == "buyer@campus.edu" and n["actor"]["phone"] == "919876543210"

    # Only the owner sees it.
    assert _notes(client, auth, "buyer")["items"] == []
    assert _notes(client, auth, "other")["items"] == []


def test_rerequest_after_denial_notifies_again(client, auth, resource_id):
    req_id = client.post(f"/api/resources/{resource_id}/access", json={}, headers=auth("buyer")).json()["id"]
    client.patch(f"/api/resources/{resource_id}/access/{req_id}", json={"status": "denied"}, headers=auth("owner"))
    client.post(f"/api/resources/{resource_id}/access", json={"note": "Sent again"}, headers=auth("buyer"))
    items = _notes(client, auth, "owner")["items"]
    assert [n["note"] for n in items] == ["Sent again", None]


def test_rejected_request_does_not_notify(client, auth, resource_id):
    client.post(f"/api/resources/{resource_id}/access", json={}, headers=auth("buyer"))
    assert client.post(f"/api/resources/{resource_id}/access", json={}, headers=auth("buyer")).status_code == 409
    assert _notes(client, auth, "owner")["unread"] == 1


def test_mark_all_read(client, auth, resource_id):
    client.post(f"/api/resources/{resource_id}/access", json={}, headers=auth("buyer"))
    client.post("/api/contact", json={"target_type": "resource", "target_id": resource_id, "channel": "email"}, headers=auth("other"))
    assert _notes(client, auth, "owner")["unread"] == 2

    assert client.post("/api/notifications/read-all", headers=auth("owner")).status_code == 204
    data = _notes(client, auth, "owner")
    assert data["unread"] == 0
    assert all(n["read"] for n in data["items"])


@pytest.mark.parametrize("target", ["resource", "listing"])
def test_contact_tap_notifies_owner_once_per_channel(client, auth, resource_id, listing_id, target):
    tid = resource_id if target == "resource" else listing_id
    body = {"target_type": target, "target_id": tid, "channel": "whatsapp"}

    assert client.post("/api/contact", json=body, headers=auth("buyer")).status_code == 200
    # Tapping again within the hour doesn't spam the owner...
    assert client.post("/api/contact", json=body, headers=auth("buyer")).status_code == 200
    # ...but switching to email is a separate event.
    client.post("/api/contact", json={**body, "channel": "email"}, headers=auth("buyer"))

    items = _notes(client, auth, "owner")["items"]
    assert sorted(n["channel"] for n in items) == ["email", "whatsapp"]
    assert all(n["type"] == "contact" and n["target_type"] == target and n["target_id"] == tid for n in items)


def test_contacting_yourself_does_not_notify(client, auth, resource_id):
    body = {"target_type": "resource", "target_id": resource_id, "channel": "whatsapp"}
    assert client.post("/api/contact", json=body, headers=auth("owner")).status_code == 200
    assert _notes(client, auth, "owner")["items"] == []


def test_notifications_require_login(client):
    assert client.get("/api/notifications").status_code in (401, 403)


def _add_note(db, user, actor, title):
    from app.models.notification import Notification

    n = Notification(user_id=user.id, actor_id=actor.id, type="contact", channel="whatsapp",
                     target_type="listing", target_id=1, target_title=title)
    db.add(n)
    db.commit()
    return n.id


def test_dismiss_one_notification(client, auth, db_session, users):
    db, _ = db_session
    keep = _add_note(db, users["owner"], users["buyer"], "Keep me")
    gone = _add_note(db, users["owner"], users["buyer"], "Dismiss me")

    assert client.delete(f"/api/notifications/{gone}", headers=auth("owner")).status_code == 204
    assert [n["id"] for n in _notes(client, auth, "owner")["items"]] == [keep]
    assert client.delete(f"/api/notifications/{gone}", headers=auth("owner")).status_code == 404


def test_cannot_dismiss_someone_elses_notification(client, auth, db_session, users):
    db, _ = db_session
    nid = _add_note(db, users["owner"], users["buyer"], "Not yours")
    assert client.delete(f"/api/notifications/{nid}", headers=auth("buyer")).status_code == 404
    assert len(_notes(client, auth, "owner")["items"]) == 1


def test_clear_all_only_clears_your_own(client, auth, db_session, users):
    db, _ = db_session
    _add_note(db, users["owner"], users["buyer"], "One")
    _add_note(db, users["owner"], users["buyer"], "Two")
    _add_note(db, users["buyer"], users["owner"], "Buyer's own")

    assert client.delete("/api/notifications", headers=auth("owner")).status_code == 204
    assert _notes(client, auth, "owner") == {"items": [], "unread": 0}
    assert len(_notes(client, auth, "buyer")["items"]) == 1
