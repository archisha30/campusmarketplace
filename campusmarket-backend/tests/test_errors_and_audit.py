"""Crashes don't leak internals and still reach the browser; admin actions leave an audit trail."""

import logging

import pytest

from app.core.config import settings


@pytest.fixture
def logs(caplog, monkeypatch):
    # The app's logger doesn't propagate (it has its own stdout handler); let caplog see it here.
    monkeypatch.setattr(logging.getLogger("campusmarket"), "propagate", True)
    caplog.set_level(logging.INFO, logger="campusmarket")
    return caplog


def test_a_crash_is_a_plain_json_500_with_cors_headers(client, auth, monkeypatch, logs):
    from app.api.routes import notifications as notif_routes

    def boom(*a, **kw):
        raise RuntimeError("secret internal detail: /srv/app.py line 42")

    monkeypatch.setattr(notif_routes, "joinedload", boom)  # any bug inside an endpoint
    origin = settings.CORS_ORIGINS[0]
    res = client.get("/api/notifications", headers={**auth("buyer"), "Origin": origin})
    assert res.status_code == 500
    assert res.json() == {"detail": "Something went wrong on our side. Try again in a minute."}
    assert "secret internal detail" not in res.text
    assert res.headers.get("access-control-allow-origin") == origin  # the app can read the error
    assert any("Unhandled error on GET /api/notifications" in r.message for r in logs.records)


def test_admin_actions_are_audited(client, auth, users, logs):
    res = client.post(f"/api/admin/users/{users['other'].id}/suspend", json={"reason": "Selling fake notes"}, headers=auth("admin"))
    assert res.status_code == 200
    client.post(f"/api/admin/users/{users['other'].id}/reinstate", headers=auth("admin"))
    lines = [r.message for r in logs.records if r.name == "campusmarket.admin"]
    assert f"admin {users['admin'].id} suspended user {users['other'].id}: Selling fake notes" in lines
    assert f"admin {users['admin'].id} reinstated user {users['other'].id}" in lines
    assert not any("@" in line for line in lines)  # ids, never emails


def test_health_says_only_ok(client):
    assert client.get("/health").json() == {"status": "ok"}
