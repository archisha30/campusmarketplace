"""Marketplace search: related words, plurals, typos, description and category."""

import pytest

from app.core.search import expand, singular
from app.models.listing import Listing

ITEMS = [
    ("Nike Air Max 270", "Clothing & Event Wear", "Size 9, worn twice."),
    ("Puma running trainers", "Sports", "Light and comfy."),
    ("Casio fx-991EX", "Electronics", "Scientific, all functions work."),
    ("Ceramic capacitor set", "Project Kits", "100 pieces."),
    ("Baseball cap", "Clothing & Event Wear", "Red, adjustable."),
    ("Study table", "Dorm Essentials", "Comes with red Adidas slides as a bonus."),
    ("Lab apron", "Lab Gear", "White, size M."),
]


@pytest.fixture
def listings(db_session, users):
    db, _ = db_session
    for title, category, description in ITEMS:
        db.add(Listing(owner_id=users["owner"].id, title=title, category=category, description=description,
                       listing_type="sale", price=100, condition="Good", pickup_spot="Gate", images=[]))
    db.commit()


def search(client, auth, q, **params):
    res = client.get("/api/listings", params={"q": q, **params}, headers=auth("buyer"))
    assert res.status_code == 200, res.text
    return [l["title"] for l in res.json()["items"]]


def test_shoes_find_brands_and_kinds(client, auth, listings):
    assert sorted(search(client, auth, "shoes")) == ["Nike Air Max 270", "Puma running trainers", "Study table"]
    assert sorted(search(client, auth, "Shoe")) == sorted(search(client, auth, "shoes"))
    assert search(client, auth, "nike") == ["Nike Air Max 270"]  # a brand only finds itself


def test_typos_and_plurals(client, auth, listings):
    assert "Nike Air Max 270" in search(client, auth, "snekers")
    assert search(client, auth, "calcultor") == ["Casio fx-991EX"]
    assert search(client, auth, "nikee") == ["Nike Air Max 270"]  # learned from listing titles
    assert "Puma running trainers" in search(client, auth, "trainer")  # trainers are shoes too
    assert search(client, auth, "calcu") == ["Casio fx-991EX"]  # while still typing


def test_word_starts_not_substrings(client, auth, listings):
    assert search(client, auth, "cap") == ["Baseball cap"]  # not "capacitor"
    assert search(client, auth, "fx-991") == ["Casio fx-991EX"]
    assert search(client, auth, "fx 991") == ["Casio fx-991EX"]


def test_description_category_and_every_word(client, auth, listings):
    assert search(client, auth, "scientific") == ["Casio fx-991EX"]  # description
    assert search(client, auth, "lab coat") == ["Lab apron"]  # related phrase
    assert search(client, auth, "red shoes") == ["Study table"]  # both words, anywhere
    assert search(client, auth, "used shoes for sale")  # filler words are ignored
    assert search(client, auth, "zzzz") == []


def test_best_match_puts_title_hits_first(client, auth, listings):
    titles = search(client, auth, "adidas", sort="relevance")
    assert titles == ["Study table"]
    titles = search(client, auth, "shoes", sort="relevance")
    assert titles[-1] == "Study table"  # only its description mentions a shoe


def test_singular_and_expand_helpers():
    assert [singular(w) for w in ("shoes", "boxes", "batteries", "glass", "bus")] == ["shoe", "box", "battery", "glass", "bus"]
    assert expand("nike") == [{"nike": True}]
    footwear = expand("footwear")[0]
    assert {"sneakers", "adidas", "flip flops"} <= footwear.keys()
    assert footwear["footwear"] is True and footwear["studs"] is False  # related words: whole words only
