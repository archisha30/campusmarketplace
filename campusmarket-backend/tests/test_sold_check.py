"""Sellers are asked "Is it sold?" about listings that have been up for 7 days."""

from datetime import date, timedelta

import pytest

from app.core.timeutil import utcnow
from app.models.listing import Listing


@pytest.fixture
def add(db_session, users):
    db, _ = db_session

    def add(title, days_old, owner="owner", **kw):
        fields = dict(category="Electronics", listing_type="sale", price=100, condition="Good", pickup_spot="Gate", images=[])
        fields.update(kw)
        listing = Listing(owner_id=users[owner].id, title=title, created_at=utcnow() - timedelta(days=days_old), **fields)
        db.add(listing)
        db.commit()
        return listing.id

    return add


def due(client, auth, who="owner"):
    res = client.get("/api/listings/sold-check", headers=auth(who))
    assert res.status_code == 200, res.text
    return [l["title"] for l in res.json()]


def test_asks_about_listings_up_for_a_week_oldest_first(client, auth, add):
    add("Week old", 7)
    add("Month old", 30)
    add("New", 6)
    add("Reserved", 10, status="reserved")
    add("Sold", 10, status="sold")
    add("Deleted", 10, deleted_at=utcnow())
    add("Old food", 10, category="F&B", expiry_date=date.today() - timedelta(days=1))
    add("Someone else's", 10, owner="admin")
    assert due(client, auth) == ["Month old", "Reserved", "Week old"]


def test_still_available_waits_another_week(client, auth, add, db_session):
    db, _ = db_session
    lid = add("Lamp", 8)
    assert client.post(f"/api/listings/{lid}/still-available", headers=auth("owner")).status_code == 204
    assert due(client, auth) == []
    db.get(Listing, lid).checked_at = utcnow() - timedelta(days=7)  # a week after that answer
    db.commit()
    assert due(client, auth) == ["Lamp"]


def test_yes_its_sold_marks_it_sold_and_counts_as_a_sale(client, auth, add):
    lid = add("Lamp", 8)
    res = client.patch(f"/api/listings/{lid}/status", json={"status": "sold"}, headers=auth("owner"))
    assert res.status_code == 200 and res.json()["status"] == "sold"
    assert due(client, auth) == []
    assert client.get("/api/users/me", headers=auth("owner")).json()["has_sold"] is True


def test_only_the_seller_can_answer(client, auth, add):
    lid = add("Lamp", 8)
    assert client.post(f"/api/listings/{lid}/still-available", headers=auth("admin")).status_code == 403
    assert client.get("/api/listings/sold-check", headers=auth("buyer")).status_code == 403  # buyers have no listings
