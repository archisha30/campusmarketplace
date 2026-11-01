"""Posting a Looking For request shows listings already for sale that match it."""

from datetime import date, timedelta

import pytest

from app.core.timeutil import utcnow
from app.models.listing import Listing


@pytest.fixture
def add(db_session, users):
    db, _ = db_session

    def add(title, owner="owner", **kw):
        fields = dict(category="Electronics", listing_type="sale", price=100, condition="Good", pickup_spot="Gate", images=[])
        fields.update(kw)
        db.add(Listing(owner_id=users[owner].id, title=title, **fields))
        db.commit()

    return add


def post(client, auth, product, description="", who="buyer"):
    res = client.post("/api/requests", json={"product": product, "description": description}, headers=auth(who))
    assert res.status_code == 201, res.text
    return res.json()


def test_matches_use_marketplace_search(client, auth, add):
    add("Casio fx-991EX")
    add("Study table", category="Dorm Essentials")
    body = post(client, auth, "calculator", "Need it for tomorrow's exam")
    assert [m["title"] for m in body["matches"]] == ["Casio fx-991EX"]
    assert body["product"] == "calculator"
    assert body["requester"]["email"] == "buyer@campus.edu"


def test_one_word_may_miss_in_longer_requests(client, auth, add):
    add("Casio fx-991EX")
    add("Casio watch", category="Clothing & Event Wear")
    assert [m["title"] for m in post(client, auth, "Casio fx-991CW calculator")["matches"]] == ["Casio fx-991EX"]
    # Two words: both must match, as in the marketplace.
    assert post(client, auth, "red calculator")["matches"] == []


def test_no_matches(client, auth, add):
    add("Study table", category="Dorm Essentials")
    assert post(client, auth, "guitar")["matches"] == []


def test_only_listings_someone_can_still_buy(client, auth, add):
    add("Casio calculator sold", status="sold")
    add("Casio calculator held", held_at=utcnow())
    add("Casio calculator deleted", deleted_at=utcnow())
    add("Casio calculator mine", owner="buyer")  # the student's own listing
    add("Casio cake", category="F&B", expiry_date=date.today() - timedelta(days=1))
    add("Casio calculator")
    assert [m["title"] for m in post(client, auth, "casio")["matches"]] == ["Casio calculator"]


def test_at_most_four_best_first(client, auth, add):
    for i in range(6):
        add(f"Desk lamp {i}", description="Has a calculator stand", category="Dorm Essentials")
    add("Calculator", category="Electronics")
    titles = [m["title"] for m in post(client, auth, "calculator")["matches"]]
    assert len(titles) == 4
    assert titles[0] == "Calculator"  # a title hit beats a description hit
