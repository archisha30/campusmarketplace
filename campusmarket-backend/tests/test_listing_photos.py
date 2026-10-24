"""Every listing needs at least one photo and a description."""

import json

from conftest import png_bytes, post_listing

def images(res) -> list:
    got = res.json()["images"]
    if got and all(len(c) == 1 for c in got):  # SQLite test artifact: ARRAY reads back as JSON characters
        got = json.loads("".join(got))
    return got


LAMP = {"title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100}


def test_photo_and_description_required(client, auth):
    res = post_listing(client, auth("owner"), LAMP, photos=0)
    assert res.status_code == 422 and "photo" in res.json()["detail"]
    for description in (None, "", "   "):
        res = post_listing(client, auth("owner"), {**LAMP, "description": description})
        assert res.status_code == 422
    # Plain JSON (no way to attach photos) is refused too.
    res = client.post("/api/listings", json={**LAMP, "description": "Bright"}, headers=auth("owner"))
    assert res.status_code == 422


def test_created_with_photos(client, auth):
    res = post_listing(client, auth("owner"), LAMP, photos=2)
    assert res.status_code == 200, res.text
    assert len(images(res)) == 2
    assert post_listing(client, auth("owner"), LAMP, photos=4).status_code == 400


def test_bad_photo_saves_nothing(client, auth):
    files = [("files", ("a.png", png_bytes(), "image/png")), ("files", ("b.png", b"<html>", "image/png"))]
    res = client.post("/api/listings", data={"data": json.dumps({**LAMP, "description": "x"})}, files=files, headers=auth("owner"))
    assert res.status_code == 400
    assert client.get("/api/listings", headers=auth("owner")).json()["items"] == []


def test_edit_cannot_remove_the_last_photo(client, auth):
    lid = post_listing(client, auth("owner"), LAMP).json()["id"]
    res = client.put(f"/api/listings/{lid}", json={"images": []}, headers=auth("owner"))
    assert res.status_code == 422 and "photo" in res.json()["detail"]
    res = client.put(f"/api/listings/{lid}", json={"description": "  "}, headers=auth("owner"))
    assert res.status_code == 422

    # Swapping every old photo for new ones in one save is fine.
    res = post_listing(client, auth("owner"), {"images": [], "title": "Lamp v2"}, photos=2, method="put", url=f"/api/listings/{lid}")
    assert res.status_code == 200, res.text
    assert len(images(res)) == 2 and res.json()["title"] == "Lamp v2"


def test_resource_needs_description(create):
    res = create({"description": "  "})
    assert res.status_code == 422
