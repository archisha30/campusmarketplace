"""Looking For requests: "Found it", reply notifications and longer descriptions."""

import pytest

from conftest import post_listing


def post(client, auth, product="Casio calculator", description="", who="buyer"):
    res = client.post("/api/requests", json={"product": product, "description": description}, headers=auth(who))
    assert res.status_code == 201, res.text
    return res.json()


def found(client, auth, request_id, value=True, who="buyer"):
    return client.patch(f"/api/requests/{request_id}/found", json={"found": value}, headers=auth(who))


def feed(client, auth):
    return [r["product"] for r in client.get("/api/requests", headers=auth("owner")).json()]


def reply(client, auth, request_id, who="owner"):
    return client.post("/api/contact", json={"target_type": "request", "target_id": request_id, "channel": "whatsapp"},
                       headers=auth(who))


def notifications(client, auth, who="buyer"):
    return client.get("/api/notifications", headers=auth(who)).json()["items"]


def test_found_leaves_the_feed_and_can_be_undone(client, auth):
    req = post(client, auth)
    assert feed(client, auth) == ["Casio calculator"]
    res = found(client, auth, req["id"])
    assert res.status_code == 200 and res.json()["found"] is True
    assert feed(client, auth) == []
    mine = client.get("/api/requests/mine", headers=auth("buyer")).json()
    assert mine[0]["found"] is True  # still in your own list, marked found
    assert found(client, auth, req["id"], False).json()["found"] is False
    assert feed(client, auth) == ["Casio calculator"]


def test_only_the_requester_can_mark_it(client, auth):
    req = post(client, auth)
    assert found(client, auth, req["id"], who="other").status_code == 403
    assert found(client, auth, 9999).status_code == 404


def test_found_requests_cant_be_replied_to_or_matched(client, auth):
    req = post(client, auth)
    found(client, auth, req["id"])
    res = reply(client, auth, req["id"])
    assert res.status_code == 410 and "already found" in res.json()["detail"]
    body = {"title": "Casio fx-991EX", "category": "Electronics", "condition": "Good", "pickup_spot": "Gate", "price": 500}
    assert post_listing(client, auth("owner"), body).status_code == 200
    assert [n for n in notifications(client, auth) if n["type"] == "request_match"] == []


def test_seller_reply_notifies_the_requester_once(client, auth):
    req = post(client, auth)
    assert reply(client, auth, req["id"]).status_code == 200
    assert reply(client, auth, req["id"]).status_code == 200  # tapped again within the hour
    [n] = notifications(client, auth)
    assert (n["type"], n["target_type"], n["target_id"], n["channel"]) == ("contact", "request", req["id"], "whatsapp")
    assert n["target_title"] == "Casio calculator"
    assert n["actor"]["name"] == "Owner" and n["actor"]["phone"]  # so they can message the seller back


@pytest.mark.parametrize("length, status", [(200, 201), (201, 422)])
def test_descriptions_up_to_200_characters(client, auth, length, status):
    res = client.post("/api/requests", json={"product": "Drafter", "description": "x" * length}, headers=auth("buyer"))
    assert res.status_code == status
