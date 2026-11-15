"""Buyers can become sellers; sellers can switch back only if they've never sold anything."""

from app.core.timeutil import utcnow
from app.models.listing import Listing
from conftest import post_listing

LAMP = {"title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100}


def switch(client, auth, who, account_type):
    return client.post("/api/auth/account-type", json={"account_type": account_type}, headers=auth(who))


def me(client, auth, who):
    return client.get("/api/users/me", headers=auth(who)).json()


def test_buyer_becomes_seller_and_back_while_nothing_is_sold(client, auth):
    assert switch(client, auth, "buyer", "seller").json()["account_type"] == "seller"
    res = switch(client, auth, "buyer", "buyer")
    assert res.status_code == 200 and res.json()["account_type"] == "buyer"
    assert me(client, auth, "buyer")["has_sold"] is False


def test_marking_a_listing_sold_locks_the_account_as_seller(client, auth, db_session):
    db, _ = db_session
    lid = post_listing(client, auth("owner"), LAMP).json()["id"]
    client.patch(f"/api/listings/{lid}/status", json={"status": "sold"}, headers=auth("owner"))
    assert me(client, auth, "owner")["has_sold"] is True
    # Even after relisting, and after the listing is gone for good, the sale still counts.
    client.patch(f"/api/listings/{lid}/status", json={"status": "available"}, headers=auth("owner"))
    db.query(Listing).filter(Listing.id == lid).delete()
    db.commit()
    res = switch(client, auth, "owner", "buyer")
    assert res.status_code == 400 and "stays a seller" in res.json()["detail"]
    assert me(client, auth, "owner")["account_type"] == "seller"


def test_reserved_isnt_a_sale(client, auth):
    lid = post_listing(client, auth("owner"), LAMP).json()["id"]
    client.patch(f"/api/listings/{lid}/status", json={"status": "reserved"}, headers=auth("owner"))
    assert me(client, auth, "owner")["has_sold"] is False


def test_approving_a_paid_resource_request_counts_as_a_sale(client, auth, create):
    rid = create().json()["id"]  # a paid resource
    req = client.post(f"/api/resources/{rid}/access", json={"note": "paid via UPI"}, headers=auth("buyer")).json()
    client.patch(f"/api/resources/{rid}/access/{req['id']}", json={"status": "approved"}, headers=auth("owner"))
    assert me(client, auth, "owner")["has_sold"] is True


def test_denying_a_request_isnt_a_sale(client, auth, create):
    rid = create().json()["id"]
    req = client.post(f"/api/resources/{rid}/access", json={"note": "hi"}, headers=auth("buyer")).json()
    client.patch(f"/api/resources/{rid}/access/{req['id']}", json={"status": "denied"}, headers=auth("owner"))
    assert me(client, auth, "owner")["has_sold"] is False


def test_must_clear_the_shop_before_switching_back(client, auth, create, db_session):
    db, _ = db_session
    lid = post_listing(client, auth("owner"), LAMP).json()["id"]
    create()
    res = switch(client, auth, "owner", "buyer")
    assert res.status_code == 400 and res.json()["detail"] == "Delete your 1 listing and 1 resource first, then switch back to buyer"
    db.query(Listing).filter(Listing.id == lid).update({Listing.deleted_at: utcnow()})  # deleted (restorable) is fine
    db.commit()
    assert "1 resource first" in switch(client, auth, "owner", "buyer").json()["detail"]
