from unittest.mock import ANY

import pytest
from sqlalchemy import select

from app import create_app
from app.extensions import db
from app.models import User
from tests.conftest import register


def test_register_creates_user_and_logs_in(client):
    response = register(client, name=" Ana ", email=" Ana@Example.com ")
    assert response.status_code == 201
    assert response.get_json() == {"user": {"id": ANY, "name": "Ana", "email": "ana@example.com"}}
    assert "access_token" not in response.get_json()
    assert client.get("/api/auth/me").get_json()["user"]["email"] == "ana@example.com"


def test_password_is_hashed(app, client):
    register(client)
    assert db.session.scalar(select(User)).password_hash.startswith("scrypt:")


def test_duplicate_email_any_case_is_409(client):
    register(client)
    response = register(client, email="ANA@example.com")
    assert response.status_code == 409
    assert response.get_json() == {"error": "An account with this email already exists."}


@pytest.mark.parametrize("body", [
    {"name": "Ana", "email": "ana@example.com"},
    {"name": "Ana", "email": "ana@example.com", "password": 12345678},
    {"name": "Ana", "email": None, "password": "correct-horse"},
    {"name": "", "email": "ana@example.com", "password": "correct-horse"},
    {"name": "x" * 121, "email": "ana@example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana.example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@@example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@localhost", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@example.com", "password": "short"},
    {"name": "Ana", "email": "ana@example.com", "password": "x" * 129},
    {"name": "Ana", "email": "ana@example.com", "password": "correct-horse", "is_admin": True},
    {"name": "A\x00", "email": "ana@example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "a\x00b@example.com", "password": "correct-horse"},
])
def test_register_rejects_bad_input(client, body):
    response = client.post("/api/auth/register", json=body)
    assert response.status_code == 400
    assert "error" in response.get_json()


def test_me_without_session_is_401(client):
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_logout_clears_session(client):
    register(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401


def test_web_cookie_flags(client):
    cookies = register(client).headers.getlist("Set-Cookie")

    def find(name):
        return next(cookie for cookie in cookies if cookie.startswith(name + "="))

    access = find("access_token_cookie")
    assert "HttpOnly" in access
    assert "SameSite=Lax" in access
    assert "Path=/api;" in access
    assert "Max-Age=2592000" in access
    refresh = find("refresh_token_cookie")
    assert "HttpOnly" in refresh
    assert "Path=/api/auth" in refresh
    csrf = find("csrf_access_token")
    assert "HttpOnly" not in csrf
    assert "Path=/;" in csrf or csrf.endswith("Path=/")


def test_cookie_secure_outside_debug(monkeypatch):
    monkeypatch.setenv("FLASK_DEBUG", "0")
    assert create_app().config["JWT_COOKIE_SECURE"] is True


def test_short_secret_key_rejected(monkeypatch):
    monkeypatch.setenv("SECRET_KEY", "short-key")
    monkeypatch.setattr("app.load_dotenv", lambda *args, **kwargs: None)
    with pytest.raises(ValueError):
        create_app()


def test_secret_key_required(monkeypatch):
    monkeypatch.delenv("SECRET_KEY")
    monkeypatch.setattr("app.load_dotenv", lambda *args, **kwargs: None)
    with pytest.raises(ValueError):
        create_app()
