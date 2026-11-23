from datetime import datetime, timedelta, timezone
from unittest.mock import ANY

from sqlalchemy import delete, func, select, update

from app.extensions import db
from app.models import Appliance, Household, RefreshToken, User
from tests.conftest import HOME, bearer, make_household, register, start_guest


def new_guest_client(client):
    other = client.application.test_client()
    start_guest(other)
    return other


def count(model):
    return db.session.scalar(select(func.count()).select_from(model))


def test_web_guest_gets_cookies(client):
    response = start_guest(client)
    assert response.status_code == 201
    assert response.get_json() == {"user": {"id": ANY, "name": None, "email": None, "is_guest": True}}
    assert client.get("/api/auth/me").get_json()["user"]["is_guest"] is True


def test_mobile_guest_gets_tokens(client):
    body = start_guest(client, mobile=True).get_json()
    assert set(body) == {"user", "access_token", "refresh_token"}


def test_guest_can_use_features_privately(client):
    start_guest(client)
    home = make_household(client)
    assert client.get(f"/api/households/{home}/appliances").status_code == 200
    other = new_guest_client(client)
    assert other.get(f"/api/households/{home}/appliances").status_code == 404


def test_cleanup_deletes_abandoned_guest_with_appliances(app, client):
    token = start_guest(client, mobile=True).get_json()["access_token"]
    home = client.post("/api/households", headers=bearer(token), json=HOME).get_json()["item"]["id"]
    created = client.post(f"/api/households/{home}/appliances", headers=bearer(token),
                          json={"name": "Fan", "watts": 50, "hours_per_day": 4})
    assert created.status_code == 201
    db.session.execute(delete(RefreshToken))
    db.session.commit()
    start_guest(client)
    assert db.session.get(Household, home) is None
    assert count(Appliance) == 0


def test_cleanup_keeps_real_users_and_active_guests(app, client):
    register(client)
    client.post("/api/auth/logout")
    start_guest(client, mobile=True)
    start_guest(client)
    emails = [user.email for user in db.session.scalars(select(User))]
    assert "ana@example.com" in emails
    assert sum(email is None for email in emails) == 2


def test_cleanup_counts_used_rows_as_dead(app, client):
    start_guest(client, mobile=True)
    db.session.execute(update(RefreshToken).values(used_at=datetime.now(timezone.utc)))
    db.session.commit()
    start_guest(client)
    assert count(User) == 1


def test_cleanup_batch_is_capped(app, client):
    db.session.add_all([User() for _ in range(60)])
    db.session.commit()
    start_guest(client)
    assert count(User) == 11


def test_refresh_prunes_old_used_rows(app, client):
    refresh = start_guest(client, mobile=True).get_json()["refresh_token"]
    user = db.session.scalar(select(User))
    db.session.add(RefreshToken(user_id=user.id, jti="old-used",
                                expires_at=datetime.now(timezone.utc) + timedelta(days=5),
                                used_at=datetime.now(timezone.utc) - timedelta(days=2)))
    db.session.commit()
    client.post("/api/auth/refresh", headers=bearer(refresh))
    assert "old-used" not in set(db.session.scalars(select(RefreshToken.jti)))
