from app.blueprints.households import sharing

from .conftest import csrf_headers, make_household, register, start_guest


def join(client, pin):
    return client.post("/api/households/join", json={"pin": pin}, headers=csrf_headers(client))


def invite(client, household_id):
    return client.post(f"/api/households/{household_id}/invites", headers=csrf_headers(client))


def test_household_pin_expires_and_grants_single_membership(client, monkeypatch):
    clock = [1_000_000]
    monkeypatch.setattr(sharing, "now_ms", lambda: clock[0])
    owner = client
    housemate = owner.application.test_client()
    outsider = owner.application.test_client()
    assert register(owner).status_code == 201
    assert register(housemate, email="housemate@example.com").status_code == 201
    assert register(outsider, email="outsider@example.com").status_code == 201
    home = make_household(owner)
    appliances = f"/api/households/{home}/appliances?month=2026-11"
    assert housemate.get(appliances).status_code == 404
    assert invite(outsider, home).status_code == 404

    first = invite(owner, home)
    assert first.status_code == 201
    assert first.headers["Cache-Control"] == "no-store"
    assert first.json["expires_in"] == 60
    assert len(first.json["pin"]) == 8
    replacement = invite(owner, home).json["pin"]
    assert replacement != first.json["pin"]
    assert join(housemate, first.json["pin"]).status_code == 410

    clock[0] += 60_000
    assert join(housemate, replacement).status_code == 410
    last = invite(owner, home).json["pin"]
    clock[0] += 59_999
    joined = join(housemate, last)
    assert joined.status_code == 200
    assert joined.json["item"]["id"] == home
    assert joined.json["item"]["is_owner"] is False
    assert housemate.get("/api/households").json["items"] == [joined.json["item"]]
    assert join(outsider, last).status_code == 410
    assert invite(housemate, home).status_code == 404

    created = housemate.post(appliances, headers=csrf_headers(housemate),
                            json={"name": "Shared fan", "watts": 50, "hours_per_day": 3})
    assert created.status_code == 201
    assert owner.get(appliances).json["items"][0]["name"] == "Shared fan"
    assert outsider.get(appliances).status_code == 404


def test_household_pin_requires_account_and_limits_guesses(client):
    assert start_guest(client).status_code == 201
    home = make_household(client)
    assert invite(client, home).status_code == 403
    assert join(client, "00123456").status_code == 403
    account = client.application.test_client()
    assert register(account).status_code == 201
    assert join(account, "123").status_code == 400
    for _ in range(sharing.MAX_JOIN_ATTEMPTS):
        assert join(account, "00123456").status_code == 410
    assert join(account, "00123456").status_code == 429
