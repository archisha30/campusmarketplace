"""Nobody can touch anyone else's things. Each test has another *seller* (so the seller-only
check passes and only the ownership check can stop them) try every owner-only action, and
checks the item is unchanged afterwards."""

import pytest

from app.core.security import create_access_token
from conftest import _user, form, png_bytes, post_listing


@pytest.fixture
def rival(db_session):
    db, _ = db_session
    u = _user(db, "rival@campus.edu", account_type="seller")
    return {"Authorization": f"Bearer {create_access_token(u.id)}"}


@pytest.fixture
def listing(client, auth):
    res = post_listing(client, auth("owner"), {"title": "Casio fx-991EX", "category": "Electronics", "price": 500,
                                               "condition": "Good", "pickup_spot": "Library"})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
def resource(create):
    res = create()  # a paid PDF, owned by "owner"
    assert res.status_code == 201, res.text
    return res.json()


# ---------- listings ----------


def test_listing_cant_be_edited_by_someone_else(client, auth, rival, listing):
    lid = listing["id"]
    assert client.put(f"/api/listings/{lid}", json={"title": "Mine now", "price": 1}, headers=rival).status_code == 403
    assert client.patch(f"/api/listings/{lid}/status", json={"status": "sold"}, headers=rival).status_code == 403
    assert client.post(f"/api/listings/{lid}/still-available", headers=rival).status_code == 403
    photo = [("files", ("x.png", png_bytes(), "image/png"))]
    assert client.post(f"/api/listings/{lid}/images", files=photo, headers=rival).status_code == 403
    assert client.delete(f"/api/listings/{lid}", headers=rival).status_code == 403
    after = client.get(f"/api/listings/{lid}", headers=auth("buyer")).json()
    assert (after["title"], after["price"], after["status"]) == ("Casio fx-991EX", 500, "available")


def test_deleted_listing_cant_be_restored_or_seen_by_someone_else(client, auth, rival, listing):
    assert client.delete(f"/api/listings/{listing['id']}", headers=auth("owner")).status_code == 204
    assert client.post(f"/api/listings/{listing['id']}/restore", headers=rival).status_code == 404
    assert client.get("/api/trash", headers=rival).json() == []
    assert len(client.get("/api/trash", headers=auth("owner")).json()) == 1


def test_buyers_cant_use_seller_actions_at_all(client, auth, listing):
    assert client.patch(f"/api/listings/{listing['id']}/status", json={"status": "sold"}, headers=auth("buyer")).status_code == 403
    assert client.get("/api/drafts", headers=auth("buyer")).status_code == 403


# ---------- resources ----------


def test_resource_cant_be_edited_by_someone_else(client, auth, rival, resource):
    rid = resource["id"]
    assert client.put(f"/api/resources/{rid}", data=form(title="Mine now"), headers=rival).status_code == 403
    assert client.patch(f"/api/resources/{rid}/status", json={"status": "closed"}, headers=rival).status_code == 403
    assert client.delete(f"/api/resources/{rid}", headers=rival).status_code == 403
    after = client.get(f"/api/resources/{rid}", headers=auth("buyer")).json()
    assert (after["title"], after["status"]) == ("DBMS handwritten notes", "available")


def test_access_requests_are_the_owners_business_only(client, auth, rival, resource):
    rid = resource["id"]
    req = client.post(f"/api/resources/{rid}/access", json={"note": "please"}, headers=auth("buyer")).json()
    assert client.get(f"/api/resources/{rid}/access", headers=rival).status_code == 403
    assert client.patch(f"/api/resources/{rid}/access/{req['id']}", json={"status": "approved"}, headers=rival).status_code == 403
    assert client.patch(f"/api/resources/{rid}/access/{req['id']}", json={"status": "approved"}, headers=auth("buyer")).status_code == 403
    # ...so the buyer still can't download the paid file.
    assert client.get(f"/api/resources/{rid}/file", headers=auth("buyer")).status_code == 403
    assert client.get(f"/api/resources/{rid}/file", headers=rival).status_code == 403
    assert client.get(f"/api/resources/{rid}/file", headers=auth("owner")).status_code == 200


def test_deleted_resource_cant_be_restored_by_someone_else(client, auth, rival, resource):
    assert client.delete(f"/api/resources/{resource['id']}", headers=auth("owner")).status_code == 204
    assert client.post(f"/api/resources/{resource['id']}/restore", headers=rival).status_code == 404


# ---------- drafts, notifications, requests ----------


def test_drafts_are_private(client, auth, rival):
    draft = client.post("/api/drafts", json={"kind": "listing", "data": {"title": "Half-written"}}, headers=auth("owner")).json()
    did = draft["id"]
    assert client.get(f"/api/drafts/{did}", headers=rival).status_code == 404
    assert client.put(f"/api/drafts/{did}", json={"kind": "listing", "data": {"title": "x"}}, headers=rival).status_code == 404
    assert client.delete(f"/api/drafts/{did}", headers=rival).status_code == 404
    assert client.get("/api/drafts", headers=rival).json() == []
    assert client.get(f"/api/drafts/{did}", headers=auth("owner")).json()["data"]["title"] == "Half-written"


def test_notifications_are_private(client, auth, rival, resource):
    client.post(f"/api/resources/{resource['id']}/access", json={}, headers=auth("buyer"))  # notifies the owner
    mine = client.get("/api/notifications", headers=auth("owner")).json()["items"]
    assert len(mine) == 1
    assert client.get("/api/notifications", headers=rival).json()["items"] == []
    assert client.delete(f"/api/notifications/{mine[0]['id']}", headers=rival).status_code == 404
    client.delete("/api/notifications", headers=rival)  # "clear all" only clears your own
    assert len(client.get("/api/notifications", headers=auth("owner")).json()["items"]) == 1


def test_looking_for_requests_belong_to_their_poster(client, auth, rival):
    req = client.post("/api/requests", json={"product": "Casio calculator"}, headers=auth("buyer")).json()
    assert client.patch(f"/api/requests/{req['id']}/found", json={"found": True}, headers=rival).status_code == 403
    assert client.delete(f"/api/requests/{req['id']}", headers=rival).status_code == 403
    assert [r["id"] for r in client.get("/api/requests/mine", headers=auth("buyer")).json()] == [req["id"]]


# ---------- admin ----------


def test_students_cant_use_the_admin_api(client, auth, users, listing):
    student = auth("buyer")
    for path in ("/api/admin/users", "/api/admin/listings", "/api/admin/resources", "/api/admin/reports", "/api/admin/reports/summary"):
        assert client.get(path, headers=student).status_code == 403, path
    assert client.post(f"/api/admin/users/{users['other'].id}/suspend", json={"reason": "no reason"}, headers=student).status_code == 403
    assert client.post(f"/api/admin/listings/{listing['id']}/remove", json={"reason": "no reason"}, headers=student).status_code == 403
    assert client.patch(f"/api/admin/users/{users['buyer'].id}/admin", json={"is_admin": True}, headers=student).status_code == 403


def test_only_the_owner_manages_admins(client, auth, users, db_session):
    # A regular admin can't create more admins, or suspend a fellow admin.
    admin = auth("admin")
    assert client.patch(f"/api/admin/users/{users['buyer'].id}/admin", json={"is_admin": True}, headers=admin).status_code == 403
    db, _ = db_session
    second = _user(db, "admin2@campus.edu", role="admin")
    assert client.post(f"/api/admin/users/{second.id}/suspend", json={"reason": "power grab"}, headers=admin).status_code == 403


def test_logged_out_visitors_get_nothing_private(client, listing, resource):
    client.headers.pop("Authorization", None)
    for path in (f"/api/listings/{listing['id']}", "/api/listings", f"/api/resources/{resource['id']}",
                 f"/api/resources/{resource['id']}/file", "/api/notifications", "/api/drafts", "/api/wishlist", "/api/trash"):
        assert client.get(path).status_code == 401, path
