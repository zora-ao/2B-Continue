import json
from datetime import datetime, timedelta, timezone

from flask_jwt_extended import create_access_token, decode_token
from sqlalchemy import select

from app.extensions import db
from app.models import RefreshToken, User
from tests.conftest import bearer, csrf_headers, mobile_register, register

HOME = {"name": "Home", "electricity_rate": 12, "monthly_budget": 2000}


def test_mobile_register_returns_tokens_and_no_cookies(client):
    response = mobile_register(client)
    assert response.status_code == 201
    assert set(response.get_json()) == {"user", "access_token", "refresh_token"}
    assert response.headers.getlist("Set-Cookie") == []


def test_mobile_login_returns_tokens(client):
    mobile_register(client)
    response = client.post("/api/auth/login", headers={"X-Client": "mobile"},
                           json={"email": "ana@example.com", "password": "correct-horse"})
    assert response.status_code == 200
    assert "access_token" in response.get_json()


def test_mobile_bearer_needs_no_csrf(client):
    token = mobile_register(client).get_json()["access_token"]
    assert client.post("/api/households", headers=bearer(token), json=HOME).status_code == 201


def test_web_write_without_csrf_is_401(client):
    register(client)
    response = client.post("/api/households", json=HOME)
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_web_write_with_csrf_works(client):
    register(client)
    assert client.post("/api/households", headers=csrf_headers(client), json=HOME).status_code == 201


def test_refresh_token_cannot_be_used_as_access(client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    response = client.get("/api/households", headers=bearer(refresh))
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_expired_access_token_is_401(app, client):
    mobile_register(client)
    user = db.session.scalar(select(User))
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(seconds=-1))
    response = client.get("/api/households", headers=bearer(token))
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_garbage_token_is_401(client):
    response = client.get("/api/households", headers=bearer("not.a.jwt"))
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_access_token_has_no_personal_data(app, client):
    token = mobile_register(client).get_json()["access_token"]
    claims = decode_token(token)
    assert claims["sub"] == str(db.session.scalar(select(User)).id)
    assert "ana" not in json.dumps(claims).lower()


def test_register_records_refresh_row(app, client):
    mobile_register(client)
    row = db.session.scalar(select(RefreshToken))
    assert row.used_at is None
    left = row.expires_at - datetime.now(timezone.utc)
    assert timedelta(days=29, hours=23) < left <= timedelta(days=30)
