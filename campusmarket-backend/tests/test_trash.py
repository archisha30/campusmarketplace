"""Deleted tab: owner deletes are restorable for 24 hours, then removed for good."""

import pytest

from conftest import post_listing


def listing(**overrides):
    body = {"title": "Study lamp", "category": "Dorm Essentials", "listing_type": "sale", "price": 300,
            "condition": "Good", "pickup_spot": "Hostel A"}
    body.update(overrides)
    return body


@pytest.fixture
def lid(client, auth):
    res = post_listing(client, auth("owner"), listing())
    assert res.status_code == 200, res.text
    return res.json()["id"]


def test_deleted_listing_disappears_and_shows_in_trash(client, auth, lid):
    assert client.delete(f"/api/listings/{lid}", headers=auth("owner")).status_code == 204

    assert client.get(f"/api/listings/{lid}", headers=auth("buyer")).status_code == 404
    assert lid not in [l["id"] for l in client.get("/api/listings", headers=auth("buyer")).json()["items"]]
    assert lid not in [l["id"] for l in client.get("/api/listings/recommended", headers=auth("buyer")).json()["items"]]

    trash = client.get("/api/trash", headers=auth("owner")).json()
    assert [(t["type"], t["id"], t["title"]) for t in trash] == [("listing", lid, "Study lamp")]
    assert trash[0]["restore_until"] > trash[0]["deleted_at"]
    assert client.get("/api/trash", headers=auth("buyer")).json() == []  # only your own


def test_restore_brings_it_back(client, auth, lid):
    client.delete(f"/api/listings/{lid}", headers=auth("owner"))
    res = client.post(f"/api/listings/{lid}/restore", headers=auth("owner"))
    assert res.status_code == 200 and res.json()["id"] == lid
    assert client.get(f"/api/listings/{lid}", headers=auth("buyer")).status_code == 200
    assert client.get("/api/trash", headers=auth("owner")).json() == []


def test_cannot_restore_someone_elses(client, auth, lid):
    client.delete(f"/api/listings/{lid}", headers=auth("owner"))
    assert client.post(f"/api/listings/{lid}/restore", headers=auth("buyer")).status_code in (403, 404)


def test_cannot_restore_after_24_hours(client, auth, lid, expire_trash):
    client.delete(f"/api/listings/{lid}", headers=auth("owner"))
    expire_trash()
    assert client.post(f"/api/listings/{lid}/restore", headers=auth("owner")).status_code == 404
    assert client.get("/api/trash", headers=auth("owner")).json() == []


def test_deleted_listing_cannot_be_edited_reported_or_contacted(client, auth, lid):
    client.delete(f"/api/listings/{lid}", headers=auth("owner"))
    assert client.put(f"/api/listings/{lid}", json={"price": 1}, headers=auth("owner")).status_code == 404
    assert client.post("/api/reports", json={"listing_id": lid, "reason": "Spam"}, headers=auth("buyer")).status_code in (404, 422)
    assert client.post("/api/contact", json={"target_type": "listing", "target_id": lid, "channel": "email"},
                       headers=auth("buyer")).status_code == 404


def test_resource_delete_and_restore(client, auth, create):
    rid = create().json()["id"]
    assert client.delete(f"/api/resources/{rid}", headers=auth("owner")).status_code == 204
    assert client.get(f"/api/resources/{rid}", headers=auth("buyer")).status_code == 404
    assert rid not in [r["id"] for r in client.get("/api/resources", headers=auth("buyer")).json()["items"]]
    assert [t["type"] for t in client.get("/api/trash", headers=auth("owner")).json()] == ["resource"]

    assert client.post(f"/api/resources/{rid}/restore", headers=auth("owner")).status_code == 204
    assert client.get(f"/api/resources/{rid}", headers=auth("buyer")).status_code == 200
