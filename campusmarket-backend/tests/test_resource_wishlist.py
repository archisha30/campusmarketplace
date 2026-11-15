"""Resource Hub items can be saved to the wishlist, like listings."""

from app.core.timeutil import utcnow
from app.models.resource import Resource


def saved(client, auth, who="buyer"):
    res = client.get("/api/wishlist/resources", headers=auth(who))
    assert res.status_code == 200, res.text
    return [r["title"] for r in res.json()]


def test_save_list_and_unsave(client, auth, create):
    notes = create({"title": "DBMS notes"}).json()["id"]
    manual = create({"title": "Physics lab manual", "subject": "Physics"}).json()["id"]
    for rid in (notes, manual, notes):  # saving twice is fine
        assert client.put(f"/api/wishlist/resources/{rid}", headers=auth("buyer")).status_code == 204
    assert saved(client, auth) == ["Physics lab manual", "DBMS notes"]  # newest saved first
    assert client.delete(f"/api/wishlist/resources/{manual}", headers=auth("buyer")).status_code == 204
    assert saved(client, auth) == ["DBMS notes"]
    assert saved(client, auth, who="other") == []  # everyone has their own


def test_listing_and_resource_wishlists_are_separate(client, auth, create):
    rid = create({"title": "DBMS notes"}).json()["id"]
    client.put(f"/api/wishlist/resources/{rid}", headers=auth("buyer"))
    assert client.get("/api/wishlist", headers=auth("buyer")).json() == []


def test_closed_stays_deleted_and_held_drop_out(client, auth, create, db_session):
    db, _ = db_session
    ids = {t: create({"title": t}).json()["id"] for t in ("Closed", "Deleted", "Held")}
    for rid in ids.values():
        client.put(f"/api/wishlist/resources/{rid}", headers=auth("buyer"))
    db.get(Resource, ids["Closed"]).status = "closed"
    db.get(Resource, ids["Deleted"]).deleted_at = utcnow()
    db.get(Resource, ids["Held"]).held_at = utcnow()
    db.commit()
    assert saved(client, auth) == ["Closed"]


def test_unknown_or_gone_resources_cant_be_saved(client, auth, create, db_session):
    db, _ = db_session
    assert client.put("/api/wishlist/resources/9999", headers=auth("buyer")).status_code == 404
    rid = create().json()["id"]
    db.get(Resource, rid).deleted_at = utcnow()
    db.commit()
    assert client.put(f"/api/wishlist/resources/{rid}", headers=auth("buyer")).status_code == 404
    assert client.get("/api/wishlist/resources", headers=auth("unverified")).status_code == 403
