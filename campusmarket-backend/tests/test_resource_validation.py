"""Input validation for create / update, and that rejected uploads leave nothing behind."""

import pytest

from app.core.pdf_preview import MAX_PDF_BYTES
from app.models.resource import Resource
from app.schemas.resource import SUBJECTS
from conftest import make_pdf


def _count(db_session):
    db, _ = db_session
    db.expire_all()
    return db.query(Resource).count()


def _files(file_dirs):
    return [p for d in file_dirs if d.exists() for p in d.rglob("*") if p.is_file()]


@pytest.mark.parametrize(
    "pdf,status,detail",
    [
        (b"hello, definitely not a pdf", 400, "isn't a PDF"),
        (b"%PDF-1.7\nthis is garbage after a valid-looking header", 400, "couldn't be read"),
        (make_pdf(1, encrypt=True), 400, "encrypted"),
        (b"%PDF-1.7\n" + b"0" * MAX_PDF_BYTES, 413, "under 15 MB"),
    ],
    ids=["not-pdf", "corrupt", "encrypted", "too-large"],
)
def test_bad_pdf_creates_nothing(create, db_session, file_dirs, pdf, status, detail):
    res = create(pdf=pdf)
    assert res.status_code == status, res.text
    assert detail in res.json()["detail"]
    assert _count(db_session) == 0
    assert _files(file_dirs) == []


@pytest.mark.parametrize(
    "fields",
    [
        {"price": "49.5"},
        {"price": "-5"},
        {"price": "0"},  # a sale needs a price
        {"price": "abc"},
        {"description": "x" * 501},
        {"year": "5"},
        {"copy_type": "ebook"},
        {"offer_type": "rent"},
        {"subject": "   "},
        {"title": ""},
        {"delivery": None},  # soft copy without a delivery method
        {"upi_id": "not a upi"},
        {"copy_type": "hard", "delivery": None, "pickup_spot": None},  # hard copy needs a pickup spot
    ],
)
def test_invalid_fields_rejected(create, db_session, file_dirs, fields):
    res = create(fields)
    assert res.status_code == 422, res.text
    assert _count(db_session) == 0
    assert _files(file_dirs) == []


@pytest.mark.parametrize(
    "url",
    [
        "http://drive.google.com/file/d/abc",  # not https
        "https://example.com/notes.pdf",
        "https://drive.google.com.evil.com/x",
        "https://drive.google.com@evil.com/x",
        "https://evilsharepoint.com/x",
        "javascript:alert(1)",
        "ftp://dropbox.com/x",
    ],
)
def test_drive_link_must_be_https_and_allowlisted(create, db_session, url):
    res = create({"delivery": "drive", "drive_url": url}, pdf=make_pdf(1))
    assert res.status_code == 422, res.text
    assert _count(db_session) == 0


@pytest.mark.parametrize(
    "url",
    [
        "https://drive.google.com/file/d/abc/view",
        "https://docs.google.com/document/d/abc",
        "https://onedrive.live.com/?id=abc",
        "https://1drv.ms/b/s!abc",
        "https://contoso.sharepoint.com/:b:/abc",
        "https://www.dropbox.com/s/abc/notes.pdf",
        "https://mega.nz/file/abc",
    ],
)
def test_allowlisted_drive_links_accepted(create, url):
    res = create({"delivery": "drive", "drive_url": url}, pdf=make_pdf(1))
    assert res.status_code == 201, res.text


def test_drive_link_requires_sample_pdf(create, db_session):
    res = create({"delivery": "drive", "drive_url": "https://drive.google.com/file/d/abc"}, pdf=None)
    assert res.status_code == 400
    assert "sample PDF" in res.json()["detail"]
    assert _count(db_session) == 0


def test_hosted_pdf_required_for_pdf_delivery(create):
    assert create(pdf=None).status_code == 400


def test_free_forces_price_zero(create):
    res = create({"offer_type": "free", "price": "999"})
    assert res.status_code == 201
    assert res.json()["price"] == 0


def test_hard_copy_has_no_file_and_optional_sample(create):
    res = create({"copy_type": "hard", "delivery": None, "pickup_spot": "Library foyer"}, pdf=None)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["has_file"] is False and body["preview_pages"] == [] and body["delivery"] is None

    res = create(
        {"copy_type": "hard", "delivery": "pdf", "drive_url": "https://drive.google.com/x", "pickup_spot": "Gate 2"},
        pdf=make_pdf(2),
    )
    body = res.json()
    assert res.status_code == 201
    assert body["delivery"] is None and body["drive_url"] is None  # ignored for hard copies
    assert body["has_file"] is True and len(body["preview_pages"]) == 2


def test_update_with_bad_pdf_changes_nothing(client, auth, create, file_dirs):
    created = create().json()
    before = sorted(p.name for p in _files(file_dirs))
    data = {
        "title": "Renamed", "subject": "DBMS", "year": "2", "copy_type": "soft",
        "offer_type": "sale", "price": "70", "delivery": "pdf",
    }
    res = client.put(
        f"/api/resources/{created['id']}", data=data,
        files={"file": ("x.pdf", b"nope", "application/pdf")}, headers=auth("owner"),
    )
    assert res.status_code == 400
    after = client.get(f"/api/resources/{created['id']}", headers=auth("owner")).json()
    assert after["title"] == created["title"] and after["price"] == 50
    assert sorted(p.name for p in _files(file_dirs)) == before


def test_update_replaces_file_and_cleans_old_one(client, auth, create, file_dirs):
    created = create(pdf=make_pdf(3)).json()
    old = {p.name for p in _files(file_dirs)}
    data = {
        "title": "v2", "subject": "DBMS", "year": "any", "copy_type": "soft",
        "offer_type": "sale", "price": "60", "delivery": "pdf",
    }
    res = client.put(
        f"/api/resources/{created['id']}", data=data,
        files={"file": ("v2.pdf", make_pdf(5), "application/pdf")}, headers=auth("owner"),
    )
    assert res.status_code == 200, res.text
    assert res.json()["page_count"] == 5
    new = {p.name for p in _files(file_dirs)}
    assert old.isdisjoint(new)


def test_delete_removes_files(client, auth, create, db_session, file_dirs):
    rid = create().json()["id"]
    assert _files(file_dirs)
    assert client.delete(f"/api/resources/{rid}", headers=auth("owner")).status_code == 204
    assert _count(db_session) == 0
    assert _files(file_dirs) == []


def test_list_filters_and_facets(client, auth, create):
    create({"subject": "DBMS", "year": "2", "offer_type": "free", "price": "0"})
    create({"subject": "Operating Systems", "year": "any", "price": "120"})
    create({"subject": "operating systems", "year": "3", "copy_type": "hard", "delivery": None, "pickup_spot": "Gate"}, pdf=None)

    def ids(**params):
        return [i["subject"] for i in client.get("/api/resources", params=params, headers=auth("buyer")).json()["items"]]

    assert len(ids()) == 3
    # Subject filter ignores case for custom subjects too.
    assert sorted(ids(subject="OPERATING SYSTEMS")) == ["Operating Systems", "operating systems"]
    assert sorted(ids(year="2")) == ["DBMS", "Operating Systems"]  # "any" matches every year
    assert ids(copy_type="hard") == ["operating systems"]
    assert ids(offer_type="free") == ["DBMS"]
    assert sorted(ids(q="operating")) == ["Operating Systems", "operating systems"]
    prices = [i["price"] for i in client.get("/api/resources", params={"sort": "price_high"}, headers=auth("buyer")).json()["items"]]
    assert prices == sorted(prices, reverse=True)

    subjects = client.get("/api/resources/facets", headers=auth("buyer")).json()["subjects"]
    assert subjects[: len(SUBJECTS)] == list(SUBJECTS)
    # One entry per custom subject, whatever the casing.
    assert [s.lower() for s in subjects[len(SUBJECTS):]] == ["operating systems"]


def test_standard_subjects_are_canonicalised(create, client, auth):
    assert create({"subject": "  dsa "}).json()["subject"] == "DSA"
    assert create({"subject": "maths for ai/ml"}).json()["subject"] == "Maths for AI/ML"
    assert create({"subject": "Compiler Design"}).json()["subject"] == "Compiler Design"
    # Standard subjects show up even with no resources; custom ones once used.
    subjects = client.get("/api/resources/facets", headers=auth("buyer")).json()["subjects"]
    assert subjects[: len(SUBJECTS)] == list(SUBJECTS)
    assert subjects[len(SUBJECTS):] == ["Compiler Design"]
