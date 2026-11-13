"""The Seller Dashboard shows how many students opened each listing and how many tapped Contact."""

import pytest

from app.models.listing import Listing


@pytest.fixture
def lamp(db_session, users):
    db, _ = db_session
    listing = Listing(owner_id=users["owner"].id, title="Lamp", category="Dorm Essentials", listing_type="sale",
                      price=100, condition="Good", pickup_spot="Gate", images=[])
    db.add(listing)
    db.commit()
    return listing.id


def own_list(client, auth, who="owner", seller="owner", users=None):
    res = client.get("/api/listings", params={"seller_id": str(users[seller].id)}, headers=auth(who))
    assert res.status_code == 200, res.text
    return res.json()["items"]


def contact(client, auth, who, listing_id):
    res = client.post("/api/contact", json={"target_type": "listing", "target_id": listing_id, "channel": "whatsapp"},
                      headers={**auth(who), "X-Requested-With": "CampusMarket"})
    assert res.status_code == 200, res.text


def test_views_and_contacts_count_different_students(client, auth, users, lamp):
    for who in ("buyer", "buyer", "other", "owner"):  # a repeat visit and the seller's own don't count
        client.get(f"/api/listings/{lamp}", headers=auth(who))
    contact(client, auth, "buyer", lamp)
    contact(client, auth, "buyer", lamp)  # same student again
    [item] = own_list(client, auth, users=users)
    assert (item["views"], item["contacts"]) == (2, 1)


def test_zero_before_anyone_looks(client, auth, users, lamp):
    [item] = own_list(client, auth, users=users)
    assert (item["views"], item["contacts"]) == (0, 0)


def test_only_the_seller_and_admins_see_them(client, auth, users, lamp):
    client.get(f"/api/listings/{lamp}", headers=auth("buyer"))
    [theirs] = own_list(client, auth, who="other", users=users)  # another student looking at the seller's items
    assert theirs["views"] is None and theirs["contacts"] is None
    assert client.get("/api/listings", headers=auth("other")).json()["items"][0]["views"] is None
    assert client.get(f"/api/listings/{lamp}", headers=auth("other")).json()["views"] is None
    [admin_view] = own_list(client, auth, who="admin", users=users)
    assert admin_view["views"] == 2  # buyer, and "other" opening it just above


def test_admin_content_lists_and_sorts_by_views_and_contacts(client, auth, users, db_session):
    db, _ = db_session
    ids = {}
    for title in ("Lamp", "Kettle", "Fan"):
        listing = Listing(owner_id=users["owner"].id, title=title, category="Dorm Essentials", listing_type="sale",
                          price=100, condition="Good", pickup_spot="Gate", images=[])
        db.add(listing)
        db.commit()
        ids[title] = listing.id
    for who in ("buyer", "other"):
        client.get(f"/api/listings/{ids['Kettle']}", headers=auth(who))
    client.get(f"/api/listings/{ids['Fan']}", headers=auth("buyer"))
    contact(client, auth, "buyer", ids["Fan"])

    def admin_list(sort):
        res = client.get("/api/admin/listings", params={"sort": sort}, headers=auth("admin"))
        assert res.status_code == 200, res.text
        return [(l["title"], l["views"], l["contacts"]) for l in res.json()["items"]]

    assert admin_list("views") == [("Kettle", 2, 0), ("Fan", 1, 1), ("Lamp", 0, 0)]
    assert admin_list("contacts")[0] == ("Fan", 1, 1)
    assert [t for t, *_ in admin_list("newest")] == ["Fan", "Kettle", "Lamp"]
    assert client.get("/api/admin/listings", headers=auth("buyer")).status_code == 403
