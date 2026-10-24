"""Saved drafts for the Sell and Post a Resource forms."""

from app.api.routes.drafts import MAX_DRAFTS

LISTING = {"kind": "listing", "data": {"title": "Casio fx-991", "price": "900", "category": "Electronics"}}


def _create(client, auth, body=LISTING, who="owner"):
    return client.post("/api/drafts", json=body, headers=auth(who))


def test_save_list_update_and_delete(client, auth):
    res = _create(client, auth)
    assert res.status_code == 201, res.text
    draft = res.json()
    assert draft["kind"] == "listing"
    assert draft["data"] == LISTING["data"]

    res = client.put(f"/api/drafts/{draft['id']}", json={"kind": "listing", "data": {"title": "Casio fx-991CW", "price": ""}}, headers=auth("owner"))
    assert res.status_code == 200, res.text
    assert res.json()["data"] == {"title": "Casio fx-991CW", "price": ""}

    got = client.get(f"/api/drafts/{draft['id']}", headers=auth("owner")).json()
    assert got["data"]["title"] == "Casio fx-991CW"
    assert got["updated_at"].endswith(("Z", "+00:00"))  # sent with the UTC zone

    listed = client.get("/api/drafts", headers=auth("owner")).json()
    assert [d["id"] for d in listed] == [draft["id"]]

    assert client.delete(f"/api/drafts/{draft['id']}", headers=auth("owner")).status_code == 204
    assert client.get("/api/drafts", headers=auth("owner")).json() == []
    assert client.get(f"/api/drafts/{draft['id']}", headers=auth("owner")).status_code == 404


def test_newest_first_and_both_kinds(client, auth):
    first = _create(client, auth).json()
    second = _create(client, auth, {"kind": "resource", "data": {"title": "DBMS notes", "subject": "DBMS"}}).json()
    assert [d["id"] for d in client.get("/api/drafts", headers=auth("owner")).json()] == [second["id"], first["id"]]

    # Saving again moves it back to the top.
    client.put(f"/api/drafts/{first['id']}", json=LISTING, headers=auth("owner"))
    assert [d["kind"] for d in client.get("/api/drafts", headers=auth("owner")).json()] == ["listing", "resource"]


def test_drafts_are_private(client, auth, users, db_session):
    db, _ = db_session
    users["other"].account_type = "seller"
    db.commit()
    draft = _create(client, auth).json()
    assert client.get("/api/drafts", headers=auth("other")).json() == []
    assert client.get(f"/api/drafts/{draft['id']}", headers=auth("other")).status_code == 404
    assert client.put(f"/api/drafts/{draft['id']}", json=LISTING, headers=auth("other")).status_code == 404
    assert client.delete(f"/api/drafts/{draft['id']}", headers=auth("other")).status_code == 404
    assert client.get(f"/api/drafts/{draft['id']}", headers=auth("owner")).status_code == 200


def test_sellers_only(client, auth):
    assert _create(client, auth, who="buyer").status_code == 403
    assert client.get("/api/drafts", headers=auth("buyer")).status_code == 403
    assert client.get("/api/drafts").status_code == 401


def test_unknown_fields_dropped_and_long_values_rejected(client, auth):
    res = _create(client, auth, {"kind": "listing", "data": {"title": "Lamp", "owner_id": "x", "subject": "DBMS"}})
    assert res.json()["data"] == {"title": "Lamp"}

    res = _create(client, auth, {"kind": "listing", "data": {"description": "a" * 2001}})
    assert res.status_code == 422

    res = _create(client, auth, {"kind": "listing", "data": {"title": {"nested": "no"}}})
    assert res.status_code == 422

    assert _create(client, auth, {"kind": "request", "data": {}}).status_code == 422


def test_kind_cannot_change(client, auth):
    draft = _create(client, auth).json()
    res = client.put(f"/api/drafts/{draft['id']}", json={"kind": "resource", "data": {}}, headers=auth("owner"))
    assert res.status_code == 422


def test_draft_limit(client, auth):
    for _ in range(MAX_DRAFTS):
        assert _create(client, auth).status_code == 201
    res = _create(client, auth)
    assert res.status_code == 409
    assert "Drafts tab" in res.json()["detail"]
