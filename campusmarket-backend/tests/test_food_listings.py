"""F&B listings: hot/cold required, optional expiry, expired food leaves the marketplace."""

from datetime import date, timedelta

import pytest

from app.models.listing import Listing

TOMORROW = (date.today() + timedelta(days=1)).isoformat()
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()


def food(**overrides):
    body = {
        "title": "Homemade brownies", "category": "F&B", "listing_type": "sale", "price": 40,
        "condition": "Good", "pickup_spot": "Hostel B", "food_temp": "cold",
    }
    body.update(overrides)
    return {k: v for k, v in body.items() if v is not None}


def post(client, auth, body):
    return client.post("/api/listings", json=body, headers=auth("owner"))


def test_food_listing_with_temp_and_expiry(client, auth):
    res = post(client, auth, food(food_temp="hot", expiry_date=TOMORROW))
    assert res.status_code == 200, res.text
    l = res.json()
    assert l["food_temp"] == "hot" and l["expiry_date"] == TOMORROW and l["is_expired"] is False
    assert l["condition"] == "Fresh"  # wear-and-tear conditions don't apply to food
    assert l["art"]["emoji"] == "🍱"


def test_expiry_is_optional(client, auth):
    res = post(client, auth, food())
    assert res.status_code == 200 and res.json()["expiry_date"] is None


@pytest.mark.parametrize("overrides,msg", [
    ({"food_temp": None}, "hot or cold"),
    ({"listing_type": "rent"}, "not rented"),
    ({"expiry_date": YESTERDAY}, "already passed"),
])
def test_food_rules(client, auth, overrides, msg):
    res = post(client, auth, food(**overrides))
    assert res.status_code == 422 and msg in res.json()["detail"]


def test_bad_temp_value_rejected(client, auth):
    assert post(client, auth, food(food_temp="warm")).status_code == 422


def test_other_categories_never_keep_food_fields(client, auth):
    body = food(category="Electronics", food_temp="hot", expiry_date=TOMORROW, condition="Good")
    l = post(client, auth, body).json()
    assert l["food_temp"] is None and l["expiry_date"] is None and l["condition"] == "Good"


def test_switching_away_from_food_clears_fields(client, auth):
    lid = post(client, auth, food(expiry_date=TOMORROW)).json()["id"]
    res = client.put(f"/api/listings/{lid}", json={"category": "Textbooks", "condition": "Good"}, headers=auth("owner"))
    assert res.status_code == 200
    assert res.json()["food_temp"] is None and res.json()["expiry_date"] is None


def test_expired_food_hidden_from_marketplace_but_not_seller(client, auth, db_session, users):
    db, _ = db_session
    expired = Listing(
        owner_id=users["owner"].id, title="Old sandwich", category="F&B", listing_type="free", price=0,
        condition="Fresh", pickup_spot="Canteen", images=[], food_temp="cold",
        expiry_date=date.today() - timedelta(days=2),
    )
    db.add(expired)
    db.commit()
    fresh_id = post(client, auth, food(expiry_date=date.today().isoformat())).json()["id"]  # expires today: still shown

    browse = [i["id"] for i in client.get("/api/listings", headers=auth("buyer")).json()["items"]]
    assert fresh_id in browse and expired.id not in browse
    recs = [i["id"] for i in client.get("/api/listings/recommended", headers=auth("buyer")).json()["items"]]
    assert expired.id not in recs

    mine = client.get("/api/listings", params={"seller_id": str(users["owner"].id)}, headers=auth("owner")).json()["items"]
    assert any(i["id"] == expired.id and i["is_expired"] for i in mine)
    assert client.get(f"/api/listings/{expired.id}", headers=auth("buyer")).json()["is_expired"] is True

    # The seller can still edit an expired item without being blocked by its old date.
    res = client.put(f"/api/listings/{expired.id}", json={"title": "Old sandwich (sorry)"}, headers=auth("owner"))
    assert res.status_code == 200


def test_fnb_is_a_valid_interest(client, auth):
    ok = client.post("/api/auth/interests", json={"interests": ["F&B", "Electronics"]}, headers=auth("buyer"))
    assert ok.status_code == 200
    bad = client.post("/api/auth/interests", json={"interests": ["Snacks"]}, headers=auth("buyer"))
    assert bad.status_code == 422
