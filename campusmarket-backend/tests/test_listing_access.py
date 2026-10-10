"""The marketplace is for verified students only: listing reads need a verified login."""

import pytest

from app.models.listing import Listing


@pytest.fixture
def listing_id(db_session, users):
    db, _ = db_session
    listing = Listing(
        owner_id=users["owner"].id, title="boAt Airdopes", category="Electronics", listing_type="sale",
        price=900, condition="Good", pickup_spot="Library", images=[],
    )
    db.add(listing)
    db.commit()
    return listing.id


@pytest.fixture
def paths(listing_id):
    return ["/api/listings", f"/api/listings/{listing_id}", "/api/listings/recommended"]


def test_guests_cannot_see_listings(client, paths):
    for path in paths:
        assert client.get(path).status_code in (401, 403), path


def test_bad_token_cannot_see_listings(client, paths):
    for path in paths:
        assert client.get(path, headers={"Authorization": "Bearer nope"}).status_code == 401, path


def test_unverified_users_cannot_see_listings(client, auth, paths):
    for path in paths:
        res = client.get(path, headers=auth("unverified"))
        assert res.status_code == 403, path
        assert "Verify" in res.json()["detail"]


def test_verified_students_can(client, auth, paths, listing_id):
    for path in paths:
        assert client.get(path, headers=auth("buyer")).status_code == 200, path
    assert client.get("/api/listings", headers=auth("buyer")).json()["items"][0]["id"] == listing_id


def test_recommendations_can_be_limited_to_interests(client, auth, db_session, users):
    import json

    db, _ = db_session
    for title, category in [("Red Bull 4-pack", "F&B"), ("Puma sneakers", "Clothing & Event Wear"), ("boAt Airdopes", "Electronics")]:
        db.add(Listing(owner_id=users["owner"].id, title=title, category=category, listing_type="sale", price=100,
                       condition="Fresh" if category == "F&B" else "New", pickup_spot="Gate", images=[],
                       food_temp="cold" if category == "F&B" else None))
    db.commit()

    def titles(**params):
        res = client.get("/api/listings/recommended", params=params, headers=auth("buyer"))
        assert res.status_code == 200, res.text
        return [i["title"] for i in res.json()["items"]]

    # Interests = F&B: only the F&B listing, even though browsing history scores Electronics too.
    only = titles(category_scores=json.dumps({"F&B": 2, "Electronics": 1.5}), only_categories=json.dumps(["F&B"]))
    assert only == ["Red Bull 4-pack"]
    # Without the restriction (e.g. "More like this"), everything is ranked, interests first.
    ranked = titles(category_scores=json.dumps({"F&B": 2}))
    assert ranked[0] == "Red Bull 4-pack" and len(ranked) == 3
    # Interests with nothing to show come back empty rather than padded with other categories.
    assert titles(only_categories=json.dumps(["Sports"])) == []
