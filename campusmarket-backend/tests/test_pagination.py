"""Marketplace and Resource Hub lists come a page at a time when asked."""

import pytest

from app.models.listing import Listing


@pytest.fixture
def thirty_listings(db_session, users):
    db, _ = db_session
    for i in range(30):
        db.add(Listing(owner_id=users["owner"].id, title=f"Item {i:02d}", category="Sports", listing_type="sale",
                       price=100 + i, condition="Good", pickup_spot="Gate", images=[]))
    db.commit()


def page(client, auth, **params):
    res = client.get("/api/listings", params=params, headers=auth("buyer"))
    assert res.status_code == 200, res.text
    return res.json()


def test_pages_cover_everything_once(client, auth, thirty_listings):
    first = page(client, auth, page=1, page_size=12, sort="price_low")
    assert (first["total"], first["page"], first["page_size"], first["pages"]) == (30, 1, 12, 3)
    assert len(first["items"]) == 12
    seen = [i["title"] for p in (1, 2, 3) for i in page(client, auth, page=p, page_size=12, sort="price_low")["items"]]
    assert len(seen) == 30 and len(set(seen)) == 30  # no repeats, nothing missing
    assert seen == sorted(seen)  # sort order holds across pages


def test_out_of_range_pages_are_clamped(client, auth, thirty_listings):
    last = page(client, auth, page=99, page_size=12)
    assert last["page"] == 3 and len(last["items"]) == 6
    assert page(client, auth, page=0, page_size=12)["page"] == 1
    assert page(client, auth, page=1, page_size=1000)["page_size"] == 60  # capped


def test_filters_apply_before_paging(client, auth, thirty_listings):
    res = page(client, auth, page=1, page_size=5, q="Item 1")  # Item 10..19
    assert res["total"] == 10 and res["pages"] == 2


def test_without_page_everything_comes_back(client, auth, users, thirty_listings):
    # The seller's dashboard/profile ask for all of their listings.
    res = client.get("/api/listings", params={"seller_id": str(users["owner"].id)}, headers=auth("owner")).json()
    assert len(res["items"]) == 30 and res["page"] is None


def test_resources_paginate_too(client, auth, create):
    for i in range(5):
        create({"title": f"Notes {i}"})
    res = client.get("/api/resources", params={"page": 2, "page_size": 2}, headers=auth("buyer")).json()
    assert (res["total"], res["page"], res["pages"], len(res["items"])) == (5, 2, 3, 2)
