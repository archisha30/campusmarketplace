"""Listing photos get a small copy for cards, kept in step when photos change or are deleted."""

import io
from types import SimpleNamespace

from PIL import Image

from app.api.routes import listings as listing_routes
from app.api.routes.listings import sync_thumbnails
from app.core.images import THUMB_SIZE, make_thumbnail
from app.core import storage as storage_module
from app.models.listing import Listing
from app.schemas.listing import card_photo
from conftest import post_listing

LAMP = {"title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100}


def big_photo(mode="RGB", size=(2000, 1500), fmt="PNG") -> bytes:
    out = io.BytesIO()
    Image.new(mode, size, (200, 30, 30, 128) if mode == "RGBA" else (200, 30, 30)).save(out, fmt)
    return out.getvalue()


def file_exists(url: str) -> bool:
    local = storage_module.storage  # the test's temp-dir storage (see file_dirs in conftest)
    key = local.key_from_url(url)
    return key is not None and local._path(local.public_dir, key).is_file()


def stored(db, listing_id) -> Listing:
    db.expire_all()
    return db.get(Listing, listing_id)


def test_make_thumbnail_is_small_jpeg_and_handles_transparency():
    for mode in ("RGB", "RGBA", "P"):
        with Image.open(io.BytesIO(make_thumbnail(big_photo(mode)))) as img:
            assert img.format == "JPEG" and img.mode == "RGB"
            assert max(img.size) == THUMB_SIZE and img.size == (480, 360)  # keeps the shape


def test_new_listing_gets_a_thumbnail_per_photo(client, auth, db_session):
    db, _ = db_session
    res = post_listing(client, auth("owner"), LAMP, photos=2)
    assert res.status_code == 200, res.text
    listing = stored(db, res.json()["id"])
    assert len(listing.thumbnails) == 2
    assert all(t.endswith("_thumb.jpg") and file_exists(t) for t in listing.thumbnails.values())


def test_replacing_the_photos_replaces_the_thumbnails(client, auth, db_session):
    db, _ = db_session
    lid = post_listing(client, auth("owner"), LAMP, photos=2).json()["id"]
    old = list(stored(db, lid).thumbnails.values())
    res = post_listing(client, auth("owner"), {"images": []}, photos=1, method="put", url=f"/api/listings/{lid}")
    assert res.status_code == 200, res.text
    [new] = stored(db, lid).thumbnails.values()
    assert new not in old and file_exists(new)
    assert not any(file_exists(t) for t in old)  # the old ones are deleted with their photos


def test_sync_thumbnails_keeps_kept_photos_and_drops_the_rest():
    # (The test database can't keep some photos and drop others through the API: SQLite reads
    # photo lists back as text. Postgres doesn't, so the edit logic is checked directly.)
    old = {"a.jpg": "a_t.jpg", "b.jpg": "b_t.jpg"}
    thumbs, dropped = sync_thumbnails(old, kept=["b.jpg"], added={"c.jpg": "c_t.jpg"})
    assert thumbs == {"b.jpg": "b_t.jpg", "c.jpg": "c_t.jpg"} and dropped == ["a_t.jpg"]
    assert sync_thumbnails(None, kept=["a.jpg"], added={}) == ({}, [])  # photo from before thumbnails


def test_deleted_listing_takes_its_thumbnails_with_it(client, auth, db_session, expire_trash):
    db, _ = db_session
    lid = post_listing(client, auth("owner"), LAMP).json()["id"]
    [thumb] = stored(db, lid).thumbnails.values()
    client.delete(f"/api/listings/{lid}", headers=auth("owner"))
    expire_trash()
    client.delete(f"/api/listings/{post_listing(client, auth('owner'), LAMP).json()['id']}", headers=auth("owner"))  # triggers the purge
    assert not file_exists(thumb)


def test_a_failed_thumbnail_doesnt_stop_the_upload(client, auth, db_session, monkeypatch):
    db, _ = db_session

    def broken(_data):
        raise OSError("disk full")

    monkeypatch.setattr(listing_routes, "make_thumbnail", broken)
    res = post_listing(client, auth("owner"), LAMP)
    assert res.status_code == 200
    assert stored(db, res.json()["id"]).thumbnails == {}


def test_card_photo_prefers_the_thumbnail():
    with_thumb = SimpleNamespace(images=["a.jpg", "b.jpg"], thumbnails={"a.jpg": "a_thumb.jpg"})
    without = SimpleNamespace(images=["b.jpg"], thumbnails={})
    assert card_photo(with_thumb) == "a_thumb.jpg" and card_photo(with_thumb, thumbnail_only=True) == "a_thumb.jpg"
    assert card_photo(without) == "b.jpg" and card_photo(without, thumbnail_only=True) is None
    assert card_photo(SimpleNamespace(images=[], thumbnails={})) is None
