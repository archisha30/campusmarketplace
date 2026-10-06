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
