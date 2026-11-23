import threading

from sqlalchemy import select, text

from app.extensions import db
from app.models import Household, User
from tests.conftest import HOME, NEW_USER, bearer, start_guest


def run_in_thread(func):
    result = {}
    thread = threading.Thread(target=lambda: result.update(value=func()))
    thread.start()
    return thread, result


def abandoned_guest_with_home(client):
    body = start_guest(client, mobile=True).get_json()
    home = client.post("/api/households", headers=bearer(body["access_token"]),
                       json=HOME).get_json()["item"]["id"]
    client.post("/api/auth/logout", headers=bearer(body["refresh_token"]))
    return body, home


def test_cleanup_skips_guest_being_upgraded(app, client):
    body, home = abandoned_guest_with_home(client)
    guest_id = body["user"]["id"]
    other = db.engine.connect()
    tx = other.begin()
    other.execute(text("SELECT id FROM users WHERE id = :id FOR UPDATE"), {"id": guest_id})
    thread, _ = run_in_thread(lambda: app.test_client().post("/api/auth/guest"))
    thread.join(timeout=3)
    tx.commit()
    other.close()
    thread.join(timeout=10)
    db.session.expire_all()
    assert db.session.get(Household, home) is not None


def test_second_register_does_not_overwrite_first(app, client):
    body = start_guest(client, mobile=True).get_json()
    guest_id = body["user"]["id"]
    other = db.engine.connect()
    tx = other.begin()
    other.execute(text("UPDATE users SET name = 'One', email = 'one@example.com', "
                       "password_hash = 'x' WHERE id = :id"), {"id": guest_id})
    second = app.test_client()
    thread, result = run_in_thread(lambda: second.post(
        "/api/auth/register", headers={**bearer(body["access_token"]), "X-Client": "mobile"},
        json={**NEW_USER, "email": "two@example.com"}))
    thread.join(timeout=3)
    tx.commit()
    other.close()
    thread.join(timeout=10)
    db.session.expire_all()
    assert db.session.get(User, guest_id).email == "one@example.com"
    assert result["value"].status_code == 201
    assert db.session.scalar(select(User).where(User.email == "two@example.com")) is not None
