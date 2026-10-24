"""Security hardening: real-image checks on uploads, code-email limits, field bounds,
response headers, and the PDF render cap."""

import io

import pymupdf
import pytest
from PIL import Image

from app.api.routes import auth as auth_routes
from app.api.routes import listings as listings_routes
from app.core.pdf_preview import render_previews
from app.core.storage import LocalStorage
from app.models.listing import Listing
from conftest import post_listing


def _png():
    buf = io.BytesIO()
    Image.new("RGB", (30, 30), (0, 120, 200)).save(buf, "PNG")
    return buf.getvalue()


SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>'


def _stored(tmp_path):
    root = tmp_path / "up"
    return sorted(p.name for p in root.rglob("*") if p.is_file()) if root.exists() else []


@pytest.fixture
def listing_id(db_session, users, tmp_path, monkeypatch):
    monkeypatch.setattr(listings_routes, "storage", LocalStorage(tmp_path / "up", tmp_path / "priv"))
    # The SQLite test DB reads list columns back as text, which skews the "photos left" count.
    monkeypatch.setattr(listings_routes, "MAX_IMAGES", 10)
    db, _ = db_session
    listing = Listing(owner_id=users["owner"].id, title="Lamp", category="Dorm Essentials", listing_type="sale",
                      price=100, condition="Good", pickup_spot="Gate", images=[])
    db.add(listing)
    db.commit()
    return listing.id


# ---------- uploads ----------


def test_listing_photo_type_comes_from_the_bytes(client, auth, listing_id, tmp_path):
    # A real PNG uploaded with a misleading name and label is stored as .png.
    res = client.post(f"/api/listings/{listing_id}/images",
                      files=[("files", ("evil.html", _png(), "text/html"))], headers=auth("owner"))
    assert res.status_code == 200, res.text
    stored = _stored(tmp_path)
    assert len(stored) == 1 and stored[0].endswith(".png")


@pytest.mark.parametrize("name,data,ctype", [
    ("x.svg", SVG, "image/svg+xml"),           # SVG can carry script
    ("x.png", b"<html>hi</html>", "image/png"),  # HTML pretending to be an image
    ("x.jpg", b"\xff\xd8\xff" + b"0" * 50, "image/jpeg"),  # truncated junk
])
def test_listing_photo_rejects_non_images(client, auth, listing_id, name, data, ctype):
    res = client.post(f"/api/listings/{listing_id}/images", files=[("files", (name, data, ctype))], headers=auth("owner"))
    assert res.status_code == 400


def test_listing_photo_size_limit(client, auth, listing_id, monkeypatch):
    monkeypatch.setattr(listings_routes, "MAX_PHOTO_BYTES", 1000)
    big = io.BytesIO()
    Image.effect_noise((200, 200), 64).convert("RGB").save(big, "PNG")
    res = client.post(f"/api/listings/{listing_id}/images", files=[("files", ("big.png", big.getvalue(), "image/png"))],
                      headers=auth("owner"))
    assert res.status_code == 400 and "MB" in res.json()["detail"]


def test_bad_photo_in_a_batch_stores_nothing(client, auth, listing_id, tmp_path):
    files = [("files", ("a.png", _png(), "image/png")), ("files", ("b.svg", SVG, "image/svg+xml"))]
    assert client.post(f"/api/listings/{listing_id}/images", files=files, headers=auth("owner")).status_code == 400
    assert _stored(tmp_path) == []  # the good PNG wasn't stored either


def test_avatar_must_be_a_real_image(client, auth, tmp_path, monkeypatch):
    monkeypatch.setattr(auth_routes, "storage", LocalStorage(tmp_path / "up", tmp_path / "priv"))
    bad = client.post("/api/users/me/avatar", files={"file": ("me.svg", SVG, "image/svg+xml")}, headers=auth("buyer"))
    assert bad.status_code == 400
    ok = client.post("/api/users/me/avatar", files={"file": ("me", _png(), "application/octet-stream")}, headers=auth("buyer"))
    assert ok.status_code == 200 and ok.json()["avatar_url"].endswith(".png")


# ---------- code emails ----------


@pytest.fixture
def sent(monkeypatch):
    box = []
    monkeypatch.setattr(auth_routes, "send_otp_email", lambda email, otp, *purpose: box.append(email))
    monkeypatch.setattr(auth_routes.settings, "ALLOWED_EMAIL_DOMAINS", ["campus.edu"])
    return box


def test_one_code_per_address_per_minute(client, sent):
    assert client.post("/api/auth/signup", json={"email": "riya@campus.edu"}).status_code == 200
    again = client.post("/api/auth/signup", json={"email": "riya@campus.edu"})
    assert again.status_code == 429 and "wait" in again.json()["detail"]
    assert sent == ["riya@campus.edu"]


def test_forgot_password_limit_is_silent(client, users, sent):
    first = client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    second = client.post("/api/auth/password/forgot", json={"email": "buyer@campus.edu"})
    # Same answer both times (no account probing), but only one email goes out.
    assert first.status_code == second.status_code == 200 and first.json() == second.json()
    assert sent == ["buyer@campus.edu"]


def test_codes_per_ip_limit(client, sent, monkeypatch):
    monkeypatch.setattr(auth_routes._code_ip_limiter, "limit", 3)
    codes = [client.post("/api/auth/signup", json={"email": f"s{i}@campus.edu"}).status_code for i in range(5)]
    assert codes == [200, 200, 200, 429, 429]


# ---------- field bounds ----------


@pytest.mark.parametrize("override", [
    {"price": -5},
    {"price": 10_000_000},
    {"title": "x" * 121},
    {"description": "x" * 2001},
    {"category": "Weapons"},
])
def test_listing_fields_are_bounded(client, auth, override):
    body = {"title": "Lamp", "category": "Dorm Essentials", "condition": "Good", "pickup_spot": "Gate", "price": 100}
    assert post_listing(client, auth("owner"), {**body, **override}).status_code == 422


def test_profile_fields_are_bounded(client, auth):
    assert client.patch("/api/users/me", json={"name": "x" * 81}, headers=auth("buyer")).status_code == 422


# ---------- headers / PDF ----------


def test_security_headers(client):
    res = client.get("/api/resources/facets")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"


def test_ribbon_shaped_pdf_renders_at_sane_size():
    doc = pymupdf.open()
    doc.new_page(width=2, height=14000)  # absurdly tall, thin page
    previews = render_previews(doc)
    img = Image.open(io.BytesIO(previews[0].data))
    assert img.height <= 2000 and img.width <= 1000
