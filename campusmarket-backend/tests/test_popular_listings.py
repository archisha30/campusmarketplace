"""The landing page's listing cards: the ones the most students opened, visible without login."""

from datetime import date, timedelta

import pytest

from app.core.timeutil import utcnow
from app.models.listing import Listing
from app.models.listing_view import ListingView


@pytest.fixture
def add(db_session, users):
    db, _ = db_session

    def add(title, **kw):
        fields = dict(category="Electronics", listing_type="sale", price=100, condition="Good",
                      pickup_spot="Gate", images=[f"https://cdn.example/{title}.jpg"], description="Call 98765 43210")
        fields.update(kw)
        listing = Listing(owner_id=users["owner"].id, title=title, **fields)
        db.add(listing)
        db.commit()
        return listing.id

    return add


def popular(client):
    res = client.get("/api/listings/popular")  # no login
    assert res.status_code == 200, res.text
    return res.json()


def open_listing(client, auth, who, listing_id):
    assert client.get(f"/api/listings/{listing_id}", headers=auth(who)).status_code == 200


def test_most_opened_first_and_counted_once_per_student(client, auth, add, db_session):
    a, b, c, d, e = (add(t) for t in "ABCDE")
    for who in ("buyer", "other", "admin"):
        open_listing(client, auth, who, c)
    for _ in range(5):  # one student coming back doesn't count again
        open_listing(client, auth, "buyer", a)
    open_listing(client, auth, "other", a)
    open_listing(client, auth, "buyer", b)
    for _ in range(5):  # the seller's own visits don't count
        open_listing(client, auth, "owner", e)
    db, _ = db_session
    assert db.query(ListingView).count() == 6
    # C (3 students), A (2), B (1), then the newest unopened one fills the last spot.
    assert [l["title"] for l in popular(client)] == ["C", "A", "B", "E"]


def test_cards_show_no_seller_details(client, add):
    add("Lamp")
    [card] = popular(client)
    assert card["title"] == "Lamp" and card["image"]  # SQLite reads photo lists back as text, so not the exact URL
    assert not {"seller", "description", "pickup_spot", "condition"} & set(card)
    assert card["art"]["emoji"]


def test_only_items_still_for_sale(client, add):
    add("Sold", status="sold")
    add("Held", held_at=utcnow())
    add("Deleted", deleted_at=utcnow())
    add("Old food", category="F&B", expiry_date=date.today() - timedelta(days=1))
    add("Lamp")
    assert [l["title"] for l in popular(client)] == ["Lamp"]


def test_empty_marketplace(client):
    assert popular(client) == []
