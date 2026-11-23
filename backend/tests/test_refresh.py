from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, func, select, update

from app.extensions import db
from app.models import RefreshToken, User
from tests.conftest import bearer, csrf_headers, mobile_register, register

LOGIN = {"email": "ana@example.com", "password": "correct-horse"}


def web_refresh(client):
    return client.post("/api/auth/refresh", headers=csrf_headers(client, "refresh"))


def count_rows():
    return db.session.scalar(select(func.count()).select_from(RefreshToken))


def test_web_refresh_rotates(app, client):
    register(client)
    response = web_refresh(client)
    assert response.status_code == 200
    assert set(response.get_json()) == {"user"}
    assert any(c.startswith("access_token_cookie=") for c in response.headers.getlist("Set-Cookie"))
    rows = db.session.scalars(select(RefreshToken).order_by(RefreshToken.id)).all()
    assert len(rows) == 2
    assert rows[0].used_at is not None
    assert rows[1].used_at is None


def test_mobile_refresh_returns_json(client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    response = client.post("/api/auth/refresh", headers=bearer(refresh))
    assert response.status_code == 200
    assert set(response.get_json()) == {"user", "access_token", "refresh_token"}
    assert response.headers.getlist("Set-Cookie") == []


def test_cookie_refresh_ignores_mobile_header(client):
    register(client)
    response = client.post("/api/auth/refresh",
                           headers={**csrf_headers(client, "refresh"), "X-Client": "mobile"})
    assert response.status_code == 200
    assert set(response.get_json()) == {"user"}


def test_refresh_without_token_or_with_access_token_is_401(client):
    assert client.post("/api/auth/refresh").status_code == 401
    access = mobile_register(client).get_json()["access_token"]
    response = client.post("/api/auth/refresh", headers=bearer(access))
    assert response.status_code == 401
    assert response.get_json() == {"error": "Please log in."}


def test_web_refresh_without_csrf_is_401(client):
    register(client)
    assert client.post("/api/auth/refresh").status_code == 401


def test_reuse_within_grace_is_409_and_revokes_nothing(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    new = client.post("/api/auth/refresh", headers=bearer(refresh)).get_json()["refresh_token"]
    response = client.post("/api/auth/refresh", headers=bearer(refresh))
    assert response.status_code == 409
    assert response.get_json() == {"error": "Refresh already used."}
    assert client.post("/api/auth/refresh", headers=bearer(new)).status_code == 200


def test_reuse_after_grace_revokes_all(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    other = client.post("/api/auth/login", headers={"X-Client": "mobile"},
                        json=LOGIN).get_json()["refresh_token"]
    client.post("/api/auth/refresh", headers=bearer(refresh))
    db.session.execute(update(RefreshToken).where(RefreshToken.used_at.is_not(None))
                       .values(used_at=datetime.now(timezone.utc) - timedelta(seconds=31)))
    db.session.commit()
    assert client.post("/api/auth/refresh", headers=bearer(refresh)).status_code == 401
    assert count_rows() == 0
    assert client.post("/api/auth/refresh", headers=bearer(other)).status_code == 401


def test_refresh_after_user_deleted_is_401(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    db.session.execute(delete(User))
    db.session.commit()
    assert client.post("/api/auth/refresh", headers=bearer(refresh)).status_code == 401


def test_refresh_slides_expiry(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    db.session.execute(update(RefreshToken)
                       .values(expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
    db.session.commit()
    client.post("/api/auth/refresh", headers=bearer(refresh))
    newest = db.session.scalar(select(RefreshToken).where(RefreshToken.used_at.is_(None)))
    assert newest.expires_at - datetime.now(timezone.utc) > timedelta(days=29)


def test_mobile_logout_revokes(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    assert client.post("/api/auth/logout", headers=bearer(refresh)).status_code == 204
    assert count_rows() == 0
    assert client.post("/api/auth/refresh", headers=bearer(refresh)).status_code == 401


def test_web_logout_revokes_and_clears_cookies(app, client):
    register(client)
    response = client.post("/api/auth/logout", headers=csrf_headers(client, "refresh"))
    assert response.status_code == 204
    assert count_rows() == 0
    assert client.get("/api/auth/me").status_code == 401


def test_logout_never_fails(client):
    assert client.post("/api/auth/logout", headers=bearer("garbage")).status_code == 204
    register(client)
    assert client.post("/api/auth/logout").status_code == 204


def test_login_prunes_old_rows(app, client):
    mobile_register(client)
    user = db.session.scalar(select(User))
    now = datetime.now(timezone.utc)
    db.session.add_all([
        RefreshToken(user_id=user.id, jti="expired", expires_at=now - timedelta(seconds=1)),
        RefreshToken(user_id=user.id, jti="old-used", expires_at=now + timedelta(days=5),
                     used_at=now - timedelta(days=2)),
    ])
    db.session.commit()
    client.post("/api/auth/login", headers={"X-Client": "mobile"}, json=LOGIN)
    jtis = set(db.session.scalars(select(RefreshToken.jti)))
    assert "expired" not in jtis
    assert "old-used" not in jtis
    assert len(jtis) == 2
