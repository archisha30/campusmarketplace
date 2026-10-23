"""Optional MRP on sale listings, shown slashed next to the selling price."""

import pytest


def item(**overrides):
    body = {
        "title": "Casio fx-991EX", "category": "Electronics", "listing_type": "sale", "price": 900,
        "condition": "Good", "pickup_spot": "Library",
    }
    body.update(overrides)
    return {k: v for k, v in body.items() if v is not None}


def post(client, auth, body):
    return client.post("/api/listings", json=body, headers=auth("owner"))


def test_mrp_is_saved_and_returned(client, auth):
    res = post(client, auth, item(mrp=1500))
    assert res.status_code == 200, res.text
    assert res.json()["price"] == 900 and res.json()["mrp"] == 1500
    assert client.get(f"/api/listings/{res.json()['id']}", headers=auth("owner")).json()["mrp"] == 1500


def test_mrp_is_optional(client, auth):
    res = post(client, auth, item())
    assert res.status_code == 200 and res.json()["mrp"] is None


def test_mrp_can_equal_price(client, auth):
    assert post(client, auth, item(mrp=900)).status_code == 200


@pytest.mark.parametrize("mrp", [500, 0, -10])
def test_mrp_below_price_or_not_positive_is_rejected(client, auth, mrp):
    assert post(client, auth, item(mrp=mrp)).status_code == 422


@pytest.mark.parametrize("listing_type,price", [("rent", 50), ("free", 0)])
def test_mrp_dropped_for_rent_and_free(client, auth, listing_type, price):
    res = post(client, auth, item(listing_type=listing_type, price=price, mrp=1500))
    assert res.status_code == 200 and res.json()["mrp"] is None


def test_edit_checks_mrp_against_new_price(client, auth):
    lid = post(client, auth, item(mrp=1500)).json()["id"]
    too_high = client.put(f"/api/listings/{lid}", json={"price": 2000}, headers=auth("owner"))
    assert too_high.status_code == 422
    ok = client.put(f"/api/listings/{lid}", json={"price": 1200, "mrp": None}, headers=auth("owner"))
    assert ok.status_code == 200 and ok.json()["mrp"] is None and ok.json()["price"] == 1200
