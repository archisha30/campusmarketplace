"""Uploaded photos are public, so they're stored without EXIF (GPS location, phone model, time)."""

import io

from PIL import Image

from app.core.images import clean_image
from conftest import post_listing

GPS_IFD = 0x8825
ORIENTATION = 0x0112


def phone_photo(fmt="JPEG", rotated=False) -> bytes:
    """A photo like a phone takes: GPS coordinates in EXIF, and optionally 'rotate 90°' in EXIF."""
    img = Image.new("RGB", (40, 20), (200, 30, 30))
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # camera make
    exif.get_ifd(GPS_IFD).update({1: "N", 2: (12.0, 58.0, 0.0), 3: "E", 4: (77.0, 35.0, 0.0)})
    if rotated:
        exif[ORIENTATION] = 6  # "rotate 90° clockwise to display"
    buf = io.BytesIO()
    img.save(buf, fmt, exif=exif.tobytes())
    return buf.getvalue()


def has_location(data: bytes) -> bool:
    with Image.open(io.BytesIO(data)) as img:
        exif = img.getexif()
        return bool(exif.get_ifd(GPS_IFD)) or 0x010F in exif or "exif" in img.info


def test_the_test_photo_really_has_a_location():
    assert has_location(phone_photo())


def test_gps_and_camera_details_are_removed():
    for fmt in ("JPEG", "PNG", "WEBP"):
        cleaned, _, _ = clean_image(phone_photo(fmt))
        assert not has_location(cleaned), fmt


def test_rotation_is_applied_to_the_pixels():
    # The EXIF tag that said "rotate" is gone, so the stored photo must already be upright.
    cleaned, _, _ = clean_image(phone_photo(rotated=True))
    with Image.open(io.BytesIO(cleaned)) as img:
        assert img.size == (20, 40)


def test_listing_photo_is_stored_without_location(client, auth, file_dirs):
    _, previews = file_dirs
    res = client.post(
        "/api/listings",
        data={"data": '{"title": "Casio fx-991EX", "category": "Electronics", "price": 500, "condition": "Good",'
                      ' "description": "Works well.", "pickup_spot": "Library"}'},
        files=[("files", ("IMG_0001.jpg", phone_photo(), "image/jpeg"))],
        headers=auth("owner"),
    )
    assert res.status_code == 200, res.text
    stored = [p for p in (previews.parent / "listings").iterdir() if "_thumb" not in p.name]
    assert len(stored) == 1 and not has_location(stored[0].read_bytes())


def test_avatar_is_stored_without_location(client, auth, file_dirs):
    _, previews = file_dirs
    res = client.post("/api/users/me/avatar", files={"file": ("me.jpg", phone_photo(), "image/jpeg")}, headers=auth("buyer"))
    assert res.status_code == 200, res.text
    (stored,) = (previews.parent / "avatars").iterdir()
    assert not has_location(stored.read_bytes())


def test_ordinary_listing_upload_still_works(client, auth):
    assert post_listing(client, auth("owner"), {"title": "Racket", "category": "Sports", "price": 300,
                                                "condition": "Good", "pickup_spot": "Gate"}).status_code == 200
