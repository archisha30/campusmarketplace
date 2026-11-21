"""Students who haven't set a name are never shown by their email (the part before the @
is usually their roll number or full name, which would undo the contact-scraping protection)."""

from app.core.security import create_access_token
from conftest import _user, post_listing


def test_nameless_seller_is_not_shown_by_email(client, auth, users, db_session):
    db, _ = db_session
    seller = _user(db, "rahul.sharma22@campus.edu", name=None, account_type="seller")
    headers = {"Authorization": f"Bearer {create_access_token(seller.id)}"}
    res = post_listing(client, headers, {"title": "Drafter", "category": "Lab Gear", "price": 200,
                                         "condition": "Good", "pickup_spot": "Gate"})
    assert res.status_code == 200, res.text
    listing = client.get(f"/api/listings/{res.json()['id']}", headers=auth("buyer")).json()
    assert listing["seller"]["name"] == "CampusMarket student"
    profile = client.get(f"/api/sellers/{seller.id}", headers=auth("buyer")).json()
    assert profile["name"] == "CampusMarket student"
    assert "rahul" not in str(listing).lower() and "rahul" not in str(profile).lower()
