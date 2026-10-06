"""Profile picture upload: judged by the image type, not the file name."""

import io

import pytest
from PIL import Image

from app.api.routes import auth as auth_routes
from app.core.storage import LocalStorage


@pytest.fixture(autouse=True)
def local_storage(tmp_path, monkeypatch):
    store = LocalStorage(tmp_path / "uploads", tmp_path / "private")
    monkeypatch.setattr(auth_routes, "storage", store)
    return tmp_path / "uploads"


def _jpeg():
    buf = io.BytesIO()
    Image.new("RGB", (40, 40), (10, 120, 200)).save(buf, "JPEG")
    return buf.getvalue()


@pytest.mark.parametrize("name", ["photo.jpg", "IMG_2041.JPG", "download.jfif", "image"])
def test_jpeg_accepted_whatever_the_name(client, auth, local_storage, name):
    res = client.post("/api/users/me/avatar", files={"file": (name, _jpeg(), "image/jpeg")}, headers=auth("buyer"))
    assert res.status_code == 200, res.text
    url = res.json()["avatar_url"]
    assert url.endswith(".jpg") and "/uploads/avatars/" in url
    assert len(list((local_storage / "avatars").iterdir())) == 1


def test_replacing_removes_the_old_picture(client, auth, local_storage):
    for _ in range(2):
        client.post("/api/users/me/avatar", files={"file": ("a.jpg", _jpeg(), "image/jpeg")}, headers=auth("buyer"))
    assert len(list((local_storage / "avatars").iterdir())) == 1


def test_rejects_non_images_unknown_types_and_big_files(client, auth):
    post = lambda f: client.post("/api/users/me/avatar", files={"file": f}, headers=auth("buyer"))
    assert post(("notes.pdf", b"%PDF-1.4", "application/pdf")).status_code == 400
    assert post(("photo.heic", b"....", "image/heic")).status_code == 400
    big = post(("big.jpg", b"0" * (5 * 1024 * 1024 + 1), "image/jpeg"))
    assert big.status_code == 400 and "5 MB" in big.json()["detail"]
