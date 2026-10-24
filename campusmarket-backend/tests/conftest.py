"""Test harness: in-memory SQLite + temp file dirs. Never touches Supabase or real uploads."""

import io
import json
import os
import sqlite3

# Settings are read at import time, so these must be set before importing the app.
# Real env vars take precedence over .env, so the Supabase URL is never used here.
os.environ.update(
    DATABASE_URL="sqlite://",
    JWT_SECRET_KEY="test-secret-key-that-is-long-enough-for-hs256",
    OTP_PEPPER="test-pepper",
    SMTP_USERNAME="test",
    SMTP_PASSWORD="test",
    SMTP_FROM="test@example.com",
    ENVIRONMENT="test",  # session cookie without the Secure flag (tests use http://testserver)
)

import pymupdf
from PIL import Image
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes import resources as resources_routes
from app.core import storage as storage_module
from app.core.storage import LocalStorage
from app.core.security import create_access_token, hash_password
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.listing import Listing
from app.models.notification import Notification
from app.models.otp import OTPCode
from app.models.report import Report
from app.models.contact_reveal import ContactReveal
from app.models.draft import Draft
from app.models.banned_email import BannedEmail
from app.models.wishlist import WishlistItem
from app.models.product_request import ProductRequest
from app.models.resource import Resource, ResourceAccess
from app.models.user import User
from app.core.timeutil import utcnow


# users.interests is a Postgres ARRAY; store it as JSON text on SQLite.
@compiles(ARRAY, "sqlite")
def _array_as_json(type_, compiler, **kw):
    return "JSON"


sqlite3.register_adapter(list, json.dumps)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[User.__table__, Listing.__table__, Resource.__table__, ResourceAccess.__table__, Notification.__table__, OTPCode.__table__, Report.__table__,
        ContactReveal.__table__, ProductRequest.__table__, Draft.__table__,
        BannedEmail.__table__, WishlistItem.__table__])
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    yield session, Session
    session.close()
    engine.dispose()


@pytest.fixture
def file_dirs(tmp_path, monkeypatch):
    """Local storage rooted in a temp dir. Returns (private root, public previews dir)."""
    local = LocalStorage(tmp_path / "uploads", tmp_path / "private")
    monkeypatch.setattr(resources_routes, "storage", local)
    monkeypatch.setattr(storage_module, "storage", local)
    return tmp_path / "private", tmp_path / "uploads" / "resource-previews"


@pytest.fixture
def client(db_session, file_dirs):
    _, Session = db_session

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        c.headers["X-Requested-With"] = "CampusMarket"  # the app's CSRF header, like the real frontend
        yield c
    app.dependency_overrides.clear()


# Every test user has this password unless a test says otherwise (hashed once: argon2 is slow on purpose).
TEST_PASSWORD = "campus123"
TEST_PASSWORD_HASH = hash_password(TEST_PASSWORD)


@pytest.fixture(autouse=True)
def no_real_email(monkeypatch):
    """Tests never send real email; everything that would go out is recorded here."""
    from app.core import email as email_module

    outbox = []
    monkeypatch.setattr(email_module, "_deliver", lambda to, subject, body, html=None: outbox.append((to, subject, body)))
    return outbox


@pytest.fixture(autouse=True)
def reset_login_limiter():
    from app.api.routes import auth as auth_routes

    auth_routes._login_ip_limiter.reset()
    auth_routes._login_edge_limiter.reset()
    auth_routes._code_email_limiter.reset()
    auth_routes._code_ip_limiter.reset()
    auth_routes._code_edge_limiter.reset()
    auth_routes._unknown_email_failures.reset()
    yield


def _user(db, email, **kw):
    defaults = dict(
        password_hash=TEST_PASSWORD_HASH,
        name=email.split("@")[0].title(),
        verified=True,
        profile_completed=True,
        account_type="buyer",
        role="student",
        phone="919876543210",
        interests=[],
    )
    defaults.update(kw)
    u = User(email=email, **defaults)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@pytest.fixture
def users(db_session):
    db, _ = db_session
    return {
        "owner": _user(db, "owner@campus.edu", account_type="seller"),
        "buyer": _user(db, "buyer@campus.edu"),
        "other": _user(db, "other@campus.edu"),
        "unverified": _user(db, "new@campus.edu", verified=False, profile_completed=False),
        "admin": _user(db, "admin@campus.edu", role="admin"),
    }


@pytest.fixture
def auth(users):
    def headers(name):
        return {"Authorization": f"Bearer {create_access_token(users[name].id)}"}

    return headers


def png_bytes(color=(0, 120, 200)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (30, 30), color).save(buf, "PNG")
    return buf.getvalue()


def post_listing(client, headers, body, photos=1, method="post", url="/api/listings"):
    """Create (or PUT) a listing the way the Sell page does: fields as JSON in `data`, photos
    in `files`. Fills in a description unless the body sets one (None leaves it out)."""
    body = {"description": "Works well, collect any evening.", **body}
    body = {k: v for k, v in body.items() if v is not None}
    files = [("files", (f"p{i}.png", png_bytes(), "image/png")) for i in range(photos)]
    return getattr(client, method)(url, data={"data": json.dumps(body)}, files=files or None, headers=headers)


def make_pdf(pages=3, encrypt=False, text_lines=60) -> bytes:
    """A real PDF full of dense text, so blur/sharpness differences are measurable."""
    doc = pymupdf.open()
    for n in range(pages):
        page = doc.new_page()
        y = 50
        for i in range(text_lines):
            page.insert_text((40, y), f"Page {n + 1} line {i}: The quick brown fox jumps over the lazy dog 0123456789", fontsize=9)
            y += 12
    kwargs = {}
    if encrypt:
        kwargs = dict(encryption=pymupdf.PDF_ENCRYPT_AES_256, owner_pw="owner", user_pw="user")
    data = doc.tobytes(**kwargs)
    doc.close()
    return data


@pytest.fixture
def pdf_bytes():
    return make_pdf


def form(**overrides):
    base = {
        "title": "DBMS handwritten notes",
        "subject": "DBMS",
        "year": "2",
        "copy_type": "soft",
        "offer_type": "sale",
        "price": "50",
        "description": "All units, neatly scanned.",
        "delivery": "pdf",
        "upi_id": "owner@okbank",
    }
    base.update(overrides)
    return {k: v for k, v in base.items() if v is not None}


@pytest.fixture
def create(client, auth):
    """POST a resource as the owner. Returns the response."""

    def _create(fields=None, pdf=b"__default__", as_user="owner"):
        data = form(**(fields or {}))
        files = None
        if pdf == b"__default__":
            pdf = make_pdf(3)
        if pdf is not None:
            files = {"file": ("notes.pdf", pdf, "application/pdf")}
        return client.post("/api/resources", data=data, files=files, headers=auth(as_user))

    return _create


@pytest.fixture
def expire_trash(db_session):
    """Pretend 25 hours have passed since everything in the Deleted tab was deleted."""
    from datetime import timedelta

    from app.models.listing import Listing
    from app.models.resource import Resource

    def run():
        db, _ = db_session
        past = utcnow() - timedelta(hours=25)
        for model in (Listing, Resource):
            db.query(model).filter(model.deleted_at.isnot(None)).update({model.deleted_at: past})
        db.commit()

    return run
