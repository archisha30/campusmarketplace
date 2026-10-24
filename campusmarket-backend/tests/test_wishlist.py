"""Wishlists live on the server, so they're the same on every device."""

import pytest

from app.models.listing import Listing


@pytest.fixture
def listing_ids(db_session, users):
    db, _ = db_session
    ids = []
    for title in ("Lamp", "Kettle", "Drafter"):
        l = Listing(owner_id=users["owner"].id, title=title, category="Dorm Essentials", listing_type="sale",
                    price=100, condition="Good", pickup_spot="Gate", images=[])
        db.add(l)
        db.commit()
        ids.append(l.id)
    return ids


def saved(client, auth, who="buyer"):
    res = client.get("/api/wishlist", headers=auth(who))
    assert res.status_code == 200, res.text
    return [l["id"] for l in res.json()]


def test_save_and_remove(client, auth, listing_ids):
    a, b, _ = listing_ids
    assert client.put(f"/api/wishlist/{a}", headers=auth("buyer")).status_code == 204
    assert client.put(f"/api/wishlist/{b}", headers=auth("buyer")).status_code == 204
    assert client.put(f"/api/wishlist/{a}", headers=auth("buyer")).status_code == 204  # saving twice is fine
    assert saved(client, auth) == [b, a]  # most recently saved first
    assert saved(client, auth, "other") == []  # private

    assert client.delete(f"/api/wishlist/{a}", headers=auth("buyer")).status_code == 204
    assert client.delete(f"/api/wishlist/{a}", headers=auth("buyer")).status_code == 204
    assert saved(client, auth) == [b]


def test_unknown_or_deleted_listings(client, auth, listing_ids, db_session):
    assert client.put("/api/wishlist/99999", headers=auth("buyer")).status_code == 404
    a = listing_ids[0]
    client.put(f"/api/wishlist/{a}", headers=auth("buyer"))
    assert client.delete(f"/api/listings/{a}", headers=auth("owner")).status_code == 204
    assert saved(client, auth) == []  # deleted listings drop out


def test_import_from_browser(client, auth, listing_ids):
    a, b, c = listing_ids
    client.put(f"/api/wishlist/{c}", headers=auth("buyer"))
    res = client.post("/api/wishlist/import", json={"listing_ids": [a, b, a, 99999]}, headers=auth("buyer"))
    assert res.status_code == 200, res.text
    assert sorted(l["id"] for l in res.json()) == sorted([a, b, c])


def test_needs_login(client):
    assert client.get("/api/wishlist").status_code == 401
