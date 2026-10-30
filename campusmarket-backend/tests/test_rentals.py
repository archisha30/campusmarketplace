"""Rentals: a fixed rental period from the dropdown, optional MRP and security deposit."""

import pytest

from conftest import post_listing

CYCLE = {"title": "Hero cycle", "category": "Sports", "condition": "Good", "pickup_spot": "Gate",
         "listing_type": "rent", "price": 300}


def post(client, auth, **overrides):
    return post_listing(client, auth("owner"), {**CYCLE, **overrides})


def test_rental_with_period_mrp_and_deposit(client, auth):
    res = post(client, auth, rent_days=30, mrp=6500, security_deposit=1000)
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["rent_days"], body["mrp"], body["security_deposit"]) == (30, 6500, 1000)


def test_period_is_required_and_from_the_list(client, auth):
    res = post(client, auth)
    assert res.status_code == 422 and "how long" in res.json()["detail"]
    for odd in (19, 26, 0, "30 days"):
        assert post(client, auth, rent_days=odd).status_code == 422
    for days in (7, 15, 30, 90, 180):
        assert post(client, auth, rent_days=days).status_code == 200


def test_deposit_is_optional_whole_rupees(client, auth):
    assert post(client, auth, rent_days=7).json()["security_deposit"] is None
    assert post(client, auth, rent_days=7, security_deposit=0).json()["security_deposit"] is None
    assert post(client, auth, rent_days=7, security_deposit=499.5).status_code == 422
    assert post(client, auth, rent_days=7, security_deposit=-1).status_code == 422


@pytest.mark.parametrize("listing_type,price", [("sale", 900), ("free", 0)])
def test_only_rentals_keep_period_and_deposit(client, auth, listing_type, price):
    res = post(client, auth, listing_type=listing_type, price=price, rent_days=30, security_deposit=500)
    assert res.status_code == 200
    assert res.json()["rent_days"] is None and res.json()["security_deposit"] is None


def test_switching_to_sale_clears_rental_fields(client, auth):
    lid = post(client, auth, rent_days=15, security_deposit=500).json()["id"]
    res = client.put(f"/api/listings/{lid}", json={"listing_type": "sale", "price": 2500}, headers=auth("owner"))
    assert res.status_code == 200
    assert res.json()["rent_days"] is None and res.json()["security_deposit"] is None
    # And back to rent needs a period again.
    res = client.put(f"/api/listings/{lid}", json={"listing_type": "rent", "price": 300}, headers=auth("owner"))
    assert res.status_code == 422
