"""Looking For requests and listings find each other: posting a request shows matching listings
already for sale, and a new listing notifies students whose open request it matches."""

from datetime import date, timedelta

import pytest

from app.core.timeutil import utcnow
from app.models.listing import Listing
from app.models.product_request import VISIBLE_FOR, ProductRequest
from conftest import post_listing


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


# --- A new listing notifies students whose open request it matches ---

def publish(client, auth, title, **fields):
    body = {"title": title, "category": "Electronics", "condition": "Good", "pickup_spot": "Gate", "price": 500, **fields}
    res = post_listing(client, auth("owner"), body)
    assert res.status_code == 200, res.text
    return res.json()


def matches_for(client, auth, who):
    items = client.get("/api/notifications", headers=auth(who)).json()["items"]
    return [n for n in items if n["type"] == "request_match"]


def test_new_listing_notifies_matching_requests(client, auth):
    post(client, auth, "Casio fx-991CW calculator")
    post(client, auth, "guitar", who="other")
    listing = publish(client, auth, "Casio fx-991EX")
    [n] = matches_for(client, auth, "buyer")
    assert (n["target_type"], n["target_id"], n["target_title"]) == ("listing", listing["id"], "Casio fx-991EX")
    assert n["note"] == "Casio fx-991CW calculator"
    assert n["actor"]["name"] == "Owner"
    assert n["actor"]["email"] == "" and n["actor"]["phone"] is None  # contact goes through /api/contact
    assert matches_for(client, auth, "other") == []


def test_one_notification_per_student(client, auth):
    post(client, auth, "calculator")
    post(client, auth, "casio")
    publish(client, auth, "Casio fx-991EX")
    assert len(matches_for(client, auth, "buyer")) == 1


def test_old_suspended_and_own_requests_are_skipped(client, auth, db_session, users):
    db, _ = db_session
    post(client, auth, "calculator")
    post(client, auth, "calculator", who="other")
    post(client, auth, "calculator", who="owner")
    old = db.query(ProductRequest).filter(ProductRequest.user_id == users["buyer"].id).one()
    old.created_at = utcnow() - VISIBLE_FOR - timedelta(days=1)
    users["other"].suspended_at = utcnow()
    db.commit()
    publish(client, auth, "Casio fx-991EX")
    assert all(matches_for(client, auth, who) == [] for who in ("buyer", "owner"))
    users["other"].suspended_at = None
    db.commit()
    assert matches_for(client, auth, "other") == []
