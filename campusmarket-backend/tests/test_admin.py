"""Admin dashboard: only owners (OWNER_EMAILS) and the admins they approve."""

import pytest

from app.core.config import settings
from app.models.listing import Listing

ADMIN_PATHS = ["/api/admin/users", "/api/admin/listings", "/api/admin/resources"]


@pytest.fixture(autouse=True)
def owner_email(monkeypatch):
    # "owner@campus.edu" (the seller in conftest) is the site owner; "admin@campus.edu" has role admin.
    monkeypatch.setattr(settings, "OWNER_EMAILS", ["Owner@Campus.edu"])  # case-insensitive match


@pytest.fixture
def sold_listing(db_session, users):
    db, _ = db_session
    listing = Listing(
        owner_id=users["buyer"].id, title="Old bike", category="Sports", listing_type="sale",
        price=500, condition="Fair", pickup_spot="Gate", images=[], status="sold",
    )
    db.add(listing)
    db.commit()
    return listing.id


def test_guests_and_students_are_refused(client, auth):
    for path in ADMIN_PATHS:
        assert client.get(path).status_code in (401, 403), path
        assert client.get(path, headers=auth("buyer")).status_code == 403, path
        assert client.get(path, headers=auth("unverified")).status_code == 403, path


@pytest.mark.parametrize("who", ["owner", "admin"])
def test_owner_and_approved_admin_can_view(client, auth, who):
    for path in ADMIN_PATHS:
        assert client.get(path, headers=auth(who)).status_code == 200, path


def test_users_page_lists_everyone_with_counts(client, auth, create, sold_listing, db_session, users):
    db, _ = db_session
    users["buyer"].avatar_url = "https://example.supabase.co/storage/v1/object/public/campusmarket-public/avatars/b.jpg"
    db.commit()
    create()
    create({"subject": "DSA"})
    data = client.get("/api/admin/users", headers=auth("admin")).json()
    assert data["total"] == 5
    by_email = {u["email"]: u for u in data["items"]}
    assert by_email["owner@campus.edu"]["resources"] == 2
    assert by_email["owner@campus.edu"]["is_owner"] is True and by_email["owner@campus.edu"]["is_admin"] is True
    assert by_email["buyer@campus.edu"]["listings"] == 1
    assert by_email["buyer@campus.edu"]["avatar_url"].endswith("/avatars/b.jpg")  # profile pictures shown to admins
    assert by_email["other@campus.edu"]["avatar_url"] is None
    assert by_email["admin@campus.edu"]["is_admin"] is True and by_email["admin@campus.edu"]["is_owner"] is False
    assert by_email["new@campus.edu"]["verified"] is False

    found = client.get("/api/admin/users", params={"q": "BUYER"}, headers=auth("admin")).json()["items"]
    assert [u["email"] for u in found] == ["buyer@campus.edu"]


def test_only_the_owner_approves_admins(client, auth, users):
    buyer_id = str(users["buyer"].id)
    url = f"/api/admin/users/{buyer_id}/admin"

    # An approved admin can't approve others.
    assert client.patch(url, json={"is_admin": True}, headers=auth("admin")).status_code == 403

    res = client.patch(url, json={"is_admin": True}, headers=auth("owner"))
    assert res.status_code == 200 and res.json()["is_admin"] is True
    assert client.get("/api/admin/users", headers=auth("buyer")).status_code == 200
    assert client.get("/api/users/me", headers=auth("buyer")).json()["is_admin"] is True

    client.patch(url, json={"is_admin": False}, headers=auth("owner"))
    assert client.get("/api/admin/users", headers=auth("buyer")).status_code == 403


def test_owner_cannot_be_demoted_and_unverified_cannot_be_admin(client, auth, users):
    owner_url = f"/api/admin/users/{users['owner'].id}/admin"
    assert client.patch(owner_url, json={"is_admin": False}, headers=auth("owner")).status_code == 400
    new_url = f"/api/admin/users/{users['unverified'].id}/admin"
    assert client.patch(new_url, json={"is_admin": True}, headers=auth("owner")).status_code == 400
    assert client.patch("/api/admin/users/not-a-uuid/admin", json={"is_admin": True}, headers=auth("owner")).status_code == 404


def test_me_reports_owner_flags(client, auth):
    me = client.get("/api/users/me", headers=auth("owner")).json()
    assert me["is_owner"] is True and me["is_admin"] is True
    me = client.get("/api/users/me", headers=auth("buyer")).json()
    assert me["is_owner"] is False and me["is_admin"] is False


def test_admin_sees_and_deletes_any_listing(client, auth, sold_listing):
    items = client.get("/api/admin/listings", headers=auth("admin")).json()["items"]
    assert [i["status"] for i in items] == ["sold"]  # sold ones included
    assert client.delete(f"/api/admin/listings/{sold_listing}", headers=auth("buyer")).status_code == 403
    assert client.delete(f"/api/admin/listings/{sold_listing}", headers=auth("admin")).status_code == 204
    assert client.get("/api/admin/listings", headers=auth("admin")).json()["total"] == 0


def test_admin_sees_closed_resources_with_contact_and_can_delete(client, auth, create):
    rid = create().json()["id"]
    client.patch(f"/api/resources/{rid}/status", json={"status": "closed"}, headers=auth("owner"))
    items = client.get("/api/admin/resources", headers=auth("admin")).json()["items"]
    assert items[0]["status"] == "closed"
    assert items[0]["owner"]["email"] == "owner@campus.edu"
    assert client.delete(f"/api/resources/{rid}", headers=auth("admin")).status_code == 204
    assert client.get("/api/admin/resources", headers=auth("admin")).json()["total"] == 0
