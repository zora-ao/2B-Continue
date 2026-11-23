import pytest
from sqlalchemy import delete, select

from app.extensions import db
from app.models import Household, User
from tests.conftest import csrf_headers, make_household, register


@pytest.mark.parametrize("path", [
    "/api/households",
    "/api/households/1/appliances",
    "/api/households/1/dashboard",
    "/api/households/1/alerts",
    "/api/households/1/budget-planner",
    "/api/households/1/solar",
])
def test_protected_without_login_is_401(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_public_endpoints_open(client):
    assert client.get("/api/health").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204


def test_preflight_not_blocked(client):
    response = client.options("/api/households", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert response.status_code != 401


def test_households_scoped_to_owner(client):
    register(client, email="ana@example.com")
    ana_home = make_household(client, "Ana home")
    client.post("/api/auth/logout")
    register(client, email="ben@example.com")
    ben_home = make_household(client, "Ben home")

    items = client.get("/api/households").get_json()["items"]
    assert [household["id"] for household in items] == [ben_home]
    for path in (f"/api/households/{ana_home}/appliances",
                 f"/api/households/{ana_home}/dashboard",
                 f"/api/households/{ana_home}/alerts"):
        response = client.get(path)
        assert response.status_code == 404
        assert response.get_json() == {"error": "Requested resource not found."}
    assert client.get(f"/api/households/{ben_home}/appliances").status_code == 200


def test_cannot_write_to_others_household(client):
    register(client, email="ana@example.com")
    ana_home = make_household(client)
    client.post("/api/auth/logout")
    register(client, email="ben@example.com")
    response = client.post(f"/api/households/{ana_home}/appliances", headers=csrf_headers(client),
                           json={"name": "Fan", "watts": 50, "hours_per_day": 4})
    assert response.status_code == 404


def test_new_household_is_owned(app, client):
    register(client)
    home = make_household(client)
    assert db.session.get(Household, home).user_id == db.session.scalar(select(User)).id


def test_legacy_unowned_household_hidden(app, client):
    legacy = Household(name="Old", electricity_rate=12, monthly_budget=2000)
    db.session.add(legacy)
    db.session.commit()
    register(client)
    assert client.get("/api/households").get_json()["items"] == []
    assert client.get(f"/api/households/{legacy.id}/appliances").status_code == 404


def test_token_for_deleted_user_is_401(app, client):
    register(client)
    db.session.execute(delete(User))
    db.session.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/households").status_code == 401
