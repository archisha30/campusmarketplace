"""Supabase Storage backend, exercised against an in-memory fake of the Storage REST API."""

import json

import httpx
import pytest

from app.api.routes import resources as resources_routes
from app.core import storage as storage_module
from app.core.storage import SupabaseStorage
from conftest import make_pdf

URL = "https://abcd1234.supabase.co"
KEY = "service-role-test-key"


class FakeSupabase:
    def __init__(self):
        self.buckets: dict[str, bool] = {}
        self.objects: dict[tuple[str, str], bytes] = {}

    def __call__(self, request: httpx.Request) -> httpx.Response:
        assert request.headers["authorization"] == f"Bearer {KEY}"
        assert request.headers["apikey"] == KEY
        path = request.url.path.removeprefix("/storage/v1")
        if path == "/bucket" and request.method == "POST":
            body = json.loads(request.content)
            if body["id"] in self.buckets:
                return httpx.Response(400, json={"statusCode": "409", "error": "Duplicate", "message": "The resource already exists"})
            self.buckets[body["id"]] = body["public"]
            return httpx.Response(200, json={"name": body["id"]})
        if path.startswith("/object/") and request.method == "POST":
            bucket, key = path.removeprefix("/object/").split("/", 1)
            assert bucket in self.buckets
            self.objects[(bucket, key)] = request.content
            return httpx.Response(200, json={"Key": f"{bucket}/{key}"})
        if path.startswith("/object/") and request.method == "GET":
            bucket, key = path.removeprefix("/object/").split("/", 1)
            if (bucket, key) not in self.objects:
                return httpx.Response(400, json={"statusCode": "404", "error": "not_found"})
            return httpx.Response(200, content=self.objects[(bucket, key)])
        if path.startswith("/object/") and request.method == "DELETE":
            bucket = path.removeprefix("/object/")
            for key in json.loads(request.content)["prefixes"]:
                self.objects.pop((bucket, key), None)
            return httpx.Response(200, json=[])
        return httpx.Response(404)


@pytest.fixture
def fake():
    return FakeSupabase()


@pytest.fixture
def supa(fake):
    client = httpx.Client(transport=httpx.MockTransport(fake), headers={"Authorization": f"Bearer {KEY}", "apikey": KEY})
    return SupabaseStorage(URL, KEY, "cm-public", "cm-private", client=client)


def test_buckets_created_once_with_right_visibility(supa, fake):
    supa.put_public("listings/a.jpg", b"img", "image/jpeg")
    assert fake.buckets == {"cm-public": True, "cm-private": False}
    # A second process (or restart) finding the buckets already there is fine.
    again = SupabaseStorage(URL, KEY, "cm-public", "cm-private", client=supa.client)
    again.put_private("resources/x.pdf", b"%PDF", "application/pdf")


def test_public_and_private_round_trip(supa, fake):
    supa.put_public("listings/a.jpg", b"img", "image/jpeg")
    url = supa.public_url("listings/a.jpg")
    assert url == f"{URL}/storage/v1/object/public/cm-public/listings/a.jpg"
    assert supa.key_from_url(url) == "listings/a.jpg"
    assert supa.key_from_url("http://localhost:8000/uploads/old.jpg") is None

    supa.put_private("resources/x.pdf", b"%PDF-data", "application/pdf")
    assert ("cm-private", "resources/x.pdf") in fake.objects
    assert supa.get_private("resources/x.pdf") == b"%PDF-data"
    assert supa.get_private("resources/missing.pdf") is None

    supa.delete_public(["listings/a.jpg"])
    supa.delete_private(["resources/x.pdf"])
    assert fake.objects == {}


def test_supabase_url_derived_from_database_url(monkeypatch):
    monkeypatch.setattr(storage_module.settings, "SUPABASE_URL", None)
    monkeypatch.setattr(
        storage_module.settings, "DATABASE_URL",
        "postgresql://postgres.abcd1234:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
    )
    assert storage_module.supabase_url() == "https://abcd1234.supabase.co"


def test_resource_flow_on_supabase(client, auth, create, supa, fake, monkeypatch, expire_trash):
    monkeypatch.setattr(resources_routes, "storage", supa)
    monkeypatch.setattr(storage_module, "storage", supa)

    pdf = make_pdf(3)
    body = create(pdf=pdf).json()
    assert all(p["url"].startswith(f"{URL}/storage/v1/object/public/cm-public/resource-previews/") for p in body["preview_pages"])
    # The PDF only exists in the private bucket.
    private = [k for (b, k) in fake.objects if b == "cm-private"]
    assert len(private) == 1 and private[0].startswith("resources/")
    assert not any(k.endswith(".pdf") for (b, k) in fake.objects if b == "cm-public")

    res = client.get(f"/api/resources/{body['id']}/file", headers=auth("owner"))
    assert res.status_code == 200 and res.content == pdf
    assert client.get(f"/api/resources/{body['id']}/file", headers=auth("buyer")).status_code == 403

    assert client.delete(f"/api/resources/{body['id']}", headers=auth("owner")).status_code == 204
    assert fake.objects  # kept for the 24h restore window
    expire_trash()
    client.get("/api/trash", headers=auth("owner"))
    assert fake.objects == {}


def test_storage_outage_returns_readable_error(client, create, monkeypatch):
    def down(request):
        return httpx.Response(500, text="upstream down")

    broken = SupabaseStorage(URL, KEY, "cm-public", "cm-private", client=httpx.Client(transport=httpx.MockTransport(down)))
    monkeypatch.setattr(resources_routes, "storage", broken)
    res = create()
    assert res.status_code == 502
    assert "storage" in res.json()["detail"].lower()
