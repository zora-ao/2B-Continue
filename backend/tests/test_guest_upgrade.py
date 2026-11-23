from datetime import timedelta

from flask_jwt_extended import create_access_token
from sqlalchemy import func, select

from app.extensions import db
from app.models import Household, User
from tests.conftest import (HOME, LOGIN, NEW_USER, bearer, csrf_headers, mobile_register, register,
                            start_guest)


def guest_with_home(client, mobile=False):
    response = start_guest(client, mobile=mobile)
    headers = bearer(response.get_json()["access_token"]) if mobile else csrf_headers(client)
    home = client.post("/api/households", headers=headers, json=HOME).get_json()["item"]["id"]
    return response, home


def guest_id(response):
    return response.get_json()["user"]["id"]


def test_register_upgrades_web_guest_in_place(app, client):
    response, home = guest_with_home(client)
    upgraded = client.post("/api/auth/register", headers=csrf_headers(client), json=NEW_USER)
    assert upgraded.status_code == 200
    assert upgraded.get_json()["user"] == {"id": guest_id(response), "name": "Ana",
                                           "email": "ana@example.com", "is_guest": False}
    assert db.session.get(Household, home).user_id == guest_id(response)


def test_register_upgrades_idle_guest_with_expired_token(app, client):
    response, home = guest_with_home(client, mobile=True)
    expired = create_access_token(identity=str(guest_id(response)),
                                  expires_delta=timedelta(seconds=-1))
    upgraded = client.post("/api/auth/register", headers=bearer(expired), json=NEW_USER)
    assert upgraded.status_code == 200
    assert upgraded.get_json()["user"]["id"] == guest_id(response)
    assert set(upgraded.get_json()) == {"user", "access_token", "refresh_token"}


def test_upgrade_revokes_old_guest_refresh(client):
    body = start_guest(client, mobile=True).get_json()
    client.post("/api/auth/register", headers={**bearer(body["access_token"]), "X-Client": "mobile"},
                json=NEW_USER)
    assert client.get_cookie("refresh_token_cookie") is None
    assert client.post("/api/auth/refresh", headers=bearer(body["refresh_token"])).status_code == 401


def test_cookie_guest_upgrade_ignores_mobile_header(client):
    guest_with_home(client)
    upgraded = client.post("/api/auth/register",
                           headers={**csrf_headers(client), "X-Client": "mobile"}, json=NEW_USER)
    assert upgraded.status_code == 200
    assert set(upgraded.get_json()) == {"user"}


def test_cookie_guest_without_csrf_not_recognised(app, client):
    response, home = guest_with_home(client)
    created = client.post("/api/auth/register", json=NEW_USER)
    assert created.status_code == 201
    assert created.get_json()["user"]["id"] != guest_id(response)
    assert db.session.get(User, guest_id(response)).is_guest


def test_upgrade_to_taken_email_keeps_guest(app, client):
    register(client)
    client.post("/api/auth/logout")
    response, home = guest_with_home(client)
    upgraded = client.post("/api/auth/register", headers=csrf_headers(client), json=NEW_USER)
    assert upgraded.status_code == 409
    assert db.session.get(User, guest_id(response)).is_guest
    assert client.get(f"/api/households/{home}/appliances").status_code == 200


def test_register_with_real_user_token_creates_new_user(client):
    access = mobile_register(client).get_json()["access_token"]
    created = client.post("/api/auth/register", headers=bearer(access),
                          json={**NEW_USER, "email": "ben@example.com"})
    assert created.status_code == 201


def test_login_merges_guest_households(app, client):
    register(client)
    client.post("/api/auth/logout")
    response, home = guest_with_home(client)
    login = client.post("/api/auth/login", headers=csrf_headers(client), json=LOGIN)
    assert login.status_code == 200
    assert db.session.get(Household, home).user_id == login.get_json()["user"]["id"]
    assert db.session.get(User, guest_id(response)) is None


def test_login_merge_with_expired_guest_token(app, client):
    register(client)
    client.post("/api/auth/logout")
    response, home = guest_with_home(client, mobile=True)
    expired = create_access_token(identity=str(guest_id(response)),
                                  expires_delta=timedelta(seconds=-1))
    login = client.post("/api/auth/login", headers=bearer(expired), json=LOGIN)
    assert db.session.get(Household, home).user_id == login.get_json()["user"]["id"]


def test_failed_login_moves_nothing(app, client):
    register(client)
    client.post("/api/auth/logout")
    response, home = guest_with_home(client)
    client.post("/api/auth/login", headers=csrf_headers(client), json={**LOGIN, "password": "wrong-pass"})
    assert db.session.get(Household, home).user_id == guest_id(response)


def test_login_with_real_user_token_moves_nothing(app, client):
    access = mobile_register(client).get_json()["access_token"]
    home = client.post("/api/households", headers=bearer(access), json=HOME).get_json()["item"]["id"]
    client.post("/api/auth/login", headers=bearer(access), json=LOGIN)
    assert db.session.scalar(select(func.count()).select_from(User)) == 1
    assert db.session.get(Household, home) is not None
