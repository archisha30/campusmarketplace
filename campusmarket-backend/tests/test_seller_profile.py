"""A seller's public page: name, join date, items sold and what they have up right now."""

from datetime import date, timedelta

import pytest

from app.core.timeutil import utcnow
from app.models.listing import Listing


@pytest.fixture
def add(db_session, users):
    db, _ = db_session

    def add(title, **kw):
        fields = dict(category="Electronics", listing_type="sale", price=100, condition="Good", pickup_spot="Gate", images=[])
        fields.update(kw)
        db.add(Listing(owner_id=users["owner"].id, title=title, **fields))
        db.commit()

    return add


def profile(client, auth, users, who="owner", viewer="buyer"):
    return client.get(f"/api/sellers/{users[who].id}", headers=auth(viewer))


def test_shows_what_they_have_up_and_how_many_they_sold(client, auth, users, add, create):
    add("Lamp")
    add("Kettle", status="reserved")
    add("Old phone", status="sold")
    add("Calculator", status="sold")
    add("Deleted sold", status="sold", deleted_at=utcnow())  # deleted doesn't count
    add("Held", held_at=utcnow())
    add("Old food", category="F&B", expiry_date=date.today() - timedelta(days=1))
    create({"title": "DBMS notes"})
    res = profile(client, auth, users)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["name"] == "Owner" and body["joined_at"]
    assert body["sold_count"] == 2
    assert sorted(l["title"] for l in body["listings"]) == ["Kettle", "Lamp"]
    assert [r["title"] for r in body["resources"]] == ["DBMS notes"]


def test_no_contact_details(client, auth, users, add):
    add("Lamp")
    body = profile(client, auth, users).json()
    assert "email" not in body and "phone" not in body
    seller = body["listings"][0]["seller"]
    assert seller["email"] is None and seller["phone"] is None


def test_verified_students_only(client, auth, users):
    assert client.get(f"/api/sellers/{users['owner'].id}").status_code == 401
    assert profile(client, auth, users, viewer="unverified").status_code == 403


def test_suspended_unverified_and_unknown_are_not_found(client, auth, users, db_session):
    db, _ = db_session
    assert profile(client, auth, users, who="unverified").status_code == 404
    assert client.get("/api/sellers/not-a-uuid", headers=auth("buyer")).status_code == 404
    users["owner"].suspended_at = utcnow()
    db.commit()
    assert profile(client, auth, users).status_code == 404
