from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.extensions import db
from app.models import User
from tests.conftest import register


def login(client, email="ana@example.com", password="correct-horse"):
    return client.post("/api/auth/login", json={"email": email, "password": password})


@pytest.fixture
def ana(client):
    register(client)
    client.post("/api/auth/logout")


def test_login_success_normalizes_email(client, ana):
    response = login(client, email="  ANA@example.com ")
    assert response.status_code == 200
    assert response.get_json()["user"]["email"] == "ana@example.com"
    assert client.get("/api/auth/me").status_code == 200


@pytest.mark.parametrize("email,password", [
    ("ana@example.com", "wrong-pass"),
    ("nobody@example.com", "correct-horse"),
    ("not-an-email", "correct-horse"),
])
def test_bad_credentials_same_message(client, ana, email, password):
    response = login(client, email, password)
    assert response.status_code == 401
    assert response.get_json() == {"error": "Email or password is incorrect."}
    assert client.get("/api/auth/me").status_code == 401


def test_bad_login_body_is_400(client):
    assert client.post("/api/auth/login", json={"email": "a@example.com"}).status_code == 400
    response = client.post("/api/auth/login", json={"email": "a@example.com", "password": 5})
    assert response.status_code == 400


def test_fifth_failure_locks_even_correct_password(client, ana):
    for _ in range(5):
        assert login(client, password="wrong-pass").status_code == 401
    response = login(client)
    assert response.status_code == 429
    assert response.get_json() == {"error": "Too many failed attempts. Try again in 15 minutes."}


def test_lock_expires_and_success_resets(app, client, ana):
    for _ in range(5):
        login(client, password="wrong-pass")
    user = db.session.scalar(select(User))
    user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.session.commit()
    assert login(client).status_code == 200
    db.session.refresh(user)
    assert user.failed_login_count == 0
    assert user.locked_until is None


def test_four_failures_then_success_resets_count(app, client, ana):
    for _ in range(4):
        login(client, password="wrong-pass")
    assert login(client).status_code == 200
    assert db.session.scalar(select(User)).failed_login_count == 0
