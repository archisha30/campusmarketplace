"""Account-synced view history, and subject-based resource recommendations."""

import json

from app.api.routes.auth import VIEW_HISTORY_MAX


def _me(client, auth, who="buyer"):
    res = client.get("/api/users/me", headers=auth(who))
    assert res.status_code == 200, res.text
    return res.json()


def test_views_are_saved_to_the_account(client, auth):
    assert _me(client, auth)["view_history"] == []
    res = client.post(
        "/api/users/me/views",
        json={"views": [{"kind": "listing", "key": "Electronics"}, {"kind": "resource", "key": "DSA"}]},
        headers=auth("buyer"),
    )
    assert res.status_code == 204
    history = _me(client, auth)["view_history"]
    assert [(h["kind"], h["key"]) for h in history] == [("listing", "Electronics"), ("resource", "DSA")]
    assert all(h["ts"] > 0 for h in history)
    # Per-user: someone else's history is untouched.
    assert _me(client, auth, "other")["view_history"] == []


def test_history_is_capped_keeping_newest(client, auth):
    for i in range(3):
        views = [{"kind": "resource", "key": f"S{i}-{j}"} for j in range(25)]
        client.post("/api/users/me/views", json={"views": views}, headers=auth("buyer"))
    history = _me(client, auth)["view_history"]
    assert len(history) == VIEW_HISTORY_MAX
    assert history[-1]["key"] == "S2-24"


def test_views_validation(client, auth):
    post = lambda body, h=auth("buyer"): client.post("/api/users/me/views", json=body, headers=h)
    assert post({"views": []}).status_code == 422
    assert post({"views": [{"kind": "video", "key": "x"}]}).status_code == 422
    assert post({"views": [{"kind": "listing", "key": ""}]}).status_code == 422
    assert client.post("/api/users/me/views", json={"views": [{"kind": "listing", "key": "x"}]}).status_code in (401, 403)


def test_resource_recommendations_rank_by_subject_then_year(client, auth, create):
    dsa = create({"title": "DSA PYQs", "subject": "DSA", "year": "2"}).json()["id"]
    ml_y2 = create({"title": "ML notes", "subject": "Machine Learning", "year": "2"}).json()["id"]
    ml_y3 = create({"title": "ML cheatsheet", "subject": "Machine Learning", "year": "3"}).json()["id"]
    golang = create({"title": "Go basics", "subject": "GoLang", "year": "1"}).json()["id"]

    def ids(**params):
        res = client.get("/api/resources/recommended", params=params, headers=auth("buyer"))
        assert res.status_code == 200, res.text
        return [i["id"] for i in res.json()["items"]], res.json()["personalized"]

    # Cold start: newest first, honestly not personalized.
    order, personalized = ids()
    assert order == [golang, ml_y3, ml_y2, dsa] and personalized is False

    # Machine Learning first (case-insensitive), the 2nd-year one ahead; then DSA (year match) before GoLang.
    order, personalized = ids(subject_scores=json.dumps({"machine learning": 3}), year="2")
    assert order == [ml_y2, ml_y3, dsa, golang] and personalized is True

    order, _ = ids(subject_scores=json.dumps({"DSA": 1}), exclude_id=dsa)
    assert dsa not in order

    # Garbage input degrades to the cold-start order instead of erroring.
    assert ids(subject_scores="not json")[0] == [golang, ml_y3, ml_y2, dsa]


def test_closed_resources_not_recommended(client, auth, create):
    rid = create().json()["id"]
    client.patch(f"/api/resources/{rid}/status", json={"status": "closed"}, headers=auth("owner"))
    assert client.get("/api/resources/recommended", headers=auth("buyer")).json()["items"] == []
