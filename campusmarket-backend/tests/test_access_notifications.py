"""Buyers hear back about their access requests, and can read their notifications."""

import pytest


@pytest.fixture
def rid(create):
    res = create()  # a paid PDF resource owned by "owner"
    assert res.status_code == 201, res.text
    return res.json()["id"]


def request_access(client, auth, rid, who="buyer"):
    res = client.post(f"/api/resources/{rid}/access", json={"note": "Paid via UPI"}, headers=auth(who))
    assert res.status_code == 201, res.text
    return res.json()["id"]


def decide(client, auth, rid, req_id, status, who="owner"):
    res = client.patch(f"/api/resources/{rid}/access/{req_id}", json={"status": status}, headers=auth(who))
    assert res.status_code == 200, res.text


def buyer_notes(client, auth):
    res = client.get("/api/notifications", headers=auth("buyer"))
    assert res.status_code == 200, res.text  # buyers can list their own notifications
    return res.json()


def test_approval_notifies_the_buyer(client, auth, rid):
    decide(client, auth, rid, request_access(client, auth, rid), "approved")
    data = buyer_notes(client, auth)
    assert data["unread"] == 1
    n = data["items"][0]
    assert n["type"] == "access_approved" and n["target_type"] == "resource" and n["target_id"] == rid
    assert n["target_title"] == "DBMS handwritten notes" and n["note"] is None
    # From the owner, by name only: their phone and email aren't handed out here.
    assert n["actor"]["name"] == "Owner" and n["actor"]["email"] == "" and n["actor"]["phone"] is None


def test_denial_notifies_the_buyer(client, auth, rid):
    decide(client, auth, rid, request_access(client, auth, rid), "denied")
    n = buyer_notes(client, auth)["items"][0]
    assert n["type"] == "access_denied" and n["note"] is None


def test_revoking_says_so_and_repeats_are_quiet(client, auth, rid):
    req_id = request_access(client, auth, rid)
    decide(client, auth, rid, req_id, "approved")
    decide(client, auth, rid, req_id, "approved")  # no change: no second notification
    decide(client, auth, rid, req_id, "denied")
    types = [(n["type"], n["note"]) for n in buyer_notes(client, auth)["items"]]
    assert types == [("access_denied", "revoked"), ("access_approved", None)]


def test_admin_decision_comes_from_the_owner(client, auth, rid):
    decide(client, auth, rid, request_access(client, auth, rid), "approved", who="admin")
    assert buyer_notes(client, auth)["items"][0]["actor"]["name"] == "Owner"


def test_nobody_else_is_notified(client, auth, rid):
    decide(client, auth, rid, request_access(client, auth, rid), "approved")
    other = client.get("/api/notifications", headers=auth("other")).json()
    assert other["items"] == []
