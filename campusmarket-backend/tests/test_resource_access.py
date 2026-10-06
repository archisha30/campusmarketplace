"""Who gets the real PDF, the drive link and the seller's contact details."""

import pytest

from conftest import make_pdf


def _detail(client, rid, headers=None):
    res = client.get(f"/api/resources/{rid}", headers=headers or {})
    assert res.status_code == 200, res.text
    return res.json()


def _file(client, rid, headers=None):
    return client.get(f"/api/resources/{rid}/file", headers=headers or {})


@pytest.fixture
def paid_pdf(create):
    pdf = make_pdf(3)
    res = create(pdf=pdf)
    assert res.status_code == 201, res.text
    return res.json()["id"], pdf


@pytest.fixture
def paid_drive(create):
    res = create(
        {"delivery": "drive", "drive_url": "https://drive.google.com/file/d/abc123/view"},
        pdf=make_pdf(2),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def test_guests_cannot_see_the_resource_hub(client, paid_pdf):
    rid, _ = paid_pdf
    for path in ["/api/resources", "/api/resources/facets", "/api/resources/recommended",
                 f"/api/resources/{rid}", f"/api/resources/{rid}/file"]:
        assert client.get(path).status_code in (401, 403), path
        assert client.get(path, headers={"Authorization": "Bearer not-a-token"}).status_code == 401, path


def test_unverified_users_cannot_see_the_resource_hub(client, auth, paid_pdf):
    rid, _ = paid_pdf
    for path in ["/api/resources", "/api/resources/facets", "/api/resources/recommended",
                 f"/api/resources/{rid}", f"/api/resources/{rid}/file"]:
        assert client.get(path, headers=auth("unverified")).status_code == 403, path


def test_verified_buyer_is_locked_but_sees_contact(client, auth, paid_pdf):
    rid, _ = paid_pdf
    r = _detail(client, rid, auth("buyer"))
    assert r["access"]["full"] is False
    assert r["access"]["reason"] == "locked"
    assert r["access"]["can_request"] is True
    assert r["file_url"] is None
    assert r["owner"]["phone"] == "919876543210"
    assert r["owner"]["email"] == "owner@campus.edu"
    assert r["upi_id"] == "owner@okbank"
    assert r["pending_requests"] is None
    assert _file(client, rid, auth("buyer")).status_code == 403


@pytest.mark.parametrize("who,reason", [("owner", "owner"), ("admin", "admin")])
def test_owner_and_admin_always_have_full_access(client, auth, paid_pdf, who, reason):
    rid, pdf = paid_pdf
    r = _detail(client, rid, auth(who))
    assert r["access"]["full"] is True and r["access"]["reason"] == reason
    assert r["file_url"].endswith(f"/api/resources/{rid}/file")
    res = _file(client, rid, auth(who))
    assert res.status_code == 200
    assert res.content == pdf
    assert res.headers["content-type"] == "application/pdf"
    assert "no-store" in res.headers["cache-control"]


def test_request_deny_rerequest_approve_flow(client, auth, paid_pdf):
    rid, pdf = paid_pdf

    res = client.post(f"/api/resources/{rid}/access", json={"note": "Paid via UPI, ref 1234"}, headers=auth("buyer"))
    assert res.status_code == 201, res.text
    req_id = res.json()["id"]
    assert res.json()["status"] == "pending"

    # Duplicate while pending is rejected.
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).status_code == 409

    r = _detail(client, rid, auth("buyer"))
    assert r["access"]["reason"] == "locked"
    assert r["access"]["can_request"] is False
    assert r["access"]["request"]["status"] == "pending"
    assert _detail(client, rid, auth("owner"))["pending_requests"] == 1

    # Only the owner (or an admin) can see and decide requests.
    assert client.get(f"/api/resources/{rid}/access", headers=auth("buyer")).status_code == 403
    assert client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": "approved"}, headers=auth("buyer")).status_code == 403

    listed = client.get(f"/api/resources/{rid}/access", headers=auth("owner")).json()
    assert [a["id"] for a in listed] == [req_id]
    assert listed[0]["note"] == "Paid via UPI, ref 1234"
    assert listed[0]["requester"]["email"] == "buyer@campus.edu"

    # Deny, then the buyer may ask again.
    res = client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": "denied"}, headers=auth("owner"))
    assert res.json()["status"] == "denied"
    r = _detail(client, rid, auth("buyer"))
    assert r["access"]["can_request"] is True
    assert r["access"]["request"]["status"] == "denied"
    assert _file(client, rid, auth("buyer")).status_code == 403

    res = client.post(f"/api/resources/{rid}/access", json={"note": "Sent again"}, headers=auth("buyer"))
    assert res.status_code == 201
    assert res.json()["id"] == req_id  # same row, unique per (resource, user)
    assert res.json()["status"] == "pending"

    client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": "approved"}, headers=auth("owner"))
    r = _detail(client, rid, auth("buyer"))
    assert r["access"]["full"] is True and r["access"]["reason"] == "granted"
    res = _file(client, rid, auth("buyer"))
    assert res.status_code == 200 and res.content == pdf

    # Approval is personal: another buyer is still locked.
    assert _detail(client, rid, auth("other"))["access"]["full"] is False
    assert _file(client, rid, auth("other")).status_code == 403
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).status_code == 409


def test_drive_url_only_returned_with_full_access(client, auth, paid_drive):
    rid = paid_drive
    assert _detail(client, rid, auth("buyer"))["drive_url"] is None
    assert _detail(client, rid, auth("owner"))["drive_url"] == "https://drive.google.com/file/d/abc123/view"

    req_id = client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).json()["id"]
    client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": "approved"}, headers=auth("owner"))
    assert _detail(client, rid, auth("buyer"))["drive_url"].startswith("https://drive.google.com/")
    # Never leaks through the list endpoint either.
    assert all(i["drive_url"] is None for i in client.get("/api/resources", headers=auth("owner")).json()["items"])


def test_free_soft_copy_open_to_verified_students(client, auth, create):
    pdf = make_pdf(2)
    rid = create({"offer_type": "free", "price": "0"}, pdf=pdf).json()["id"]

    assert _file(client, rid).status_code in (401, 403)
    assert _file(client, rid, auth("unverified")).status_code == 403

    r = _detail(client, rid, auth("buyer"))
    assert r["access"] == {"full": True, "reason": "free", "can_request": False, "request": None}
    assert _file(client, rid, auth("buyer")).content == pdf
    # Nothing to request on a free resource.
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).status_code == 400


def test_closed_resource_blocks_new_requests_but_keeps_grants(client, auth, paid_pdf):
    rid, _ = paid_pdf
    req_id = client.post(f"/api/resources/{rid}/access", json={}, headers=auth("buyer")).json()["id"]
    client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": "approved"}, headers=auth("owner"))

    res = client.patch(f"/api/resources/{rid}/status", json={"status": "closed"}, headers=auth("owner"))
    assert res.status_code == 200 and res.json()["status"] == "closed"

    assert _detail(client, rid, auth("buyer"))["access"]["full"] is True
    other = _detail(client, rid, auth("other"))
    assert other["access"]["reason"] == "closed" and other["access"]["can_request"] is False
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("other")).status_code == 400

    # Closed resources drop out of browse but stay in the owner's "mine" list.
    assert client.get("/api/resources", headers=auth("other")).json()["total"] == 0
    assert client.get("/api/resources", params={"mine": "true"}, headers=auth("owner")).json()["total"] == 1


def test_owner_cannot_request_own_resource(client, auth, paid_pdf):
    rid, _ = paid_pdf
    assert client.post(f"/api/resources/{rid}/access", json={}, headers=auth("owner")).status_code == 400


def test_only_owner_manages_resource(client, auth, paid_pdf):
    rid, _ = paid_pdf
    assert client.patch(f"/api/resources/{rid}/status", json={"status": "closed"}, headers=auth("buyer")).status_code == 403
    assert client.delete(f"/api/resources/{rid}", headers=auth("buyer")).status_code == 403


def test_buyer_accounts_cannot_post(create):
    assert create(as_user="buyer").status_code == 403


def test_mine_requires_login(client):
    assert client.get("/api/resources", params={"mine": "true"}).status_code in (401, 403)
