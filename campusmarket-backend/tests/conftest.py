"""Test harness: in-memory SQLite + temp file dirs. Never touches Supabase or real uploads."""

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
)

import pymupdf
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
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.listing import Listing
from app.models.notification import Notification
from app.models.otp import OTPCode
from app.models.report import Report
from app.models.resource import Resource, ResourceAccess
from app.models.user import User


# users.interests is a Postgres ARRAY; store it as JSON text on SQLite.
@compiles(ARRAY, "sqlite")
def _array_as_json(type_, compiler, **kw):
    return "JSON"


sqlite3.register_adapter(list, json.dumps)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine, tables=[User.__table__, Listing.__table__, Resource.__table__, ResourceAccess.__table__, Notification.__table__, OTPCode.__table__, Report.__table__])
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
        yield c
    app.dependency_overrides.clear()


def _user(db, email, **kw):
    defaults = dict(
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
