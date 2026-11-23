from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Household, RefreshToken, User


def test_user_email_is_unique(app):
    db.session.add(User(name="A", email="a@example.com", password_hash="x"))
    db.session.commit()
    db.session.add(User(name="B", email="a@example.com", password_hash="y"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_household_owner_is_optional(app):
    db.session.add(Household(name="Old", electricity_rate=12, monthly_budget=2000))
    db.session.commit()
    assert db.session.scalar(select(Household)).user_id is None


def test_user_defaults(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user)
    db.session.commit()
    assert user.failed_login_count == 0
    assert user.locked_until is None
    assert user.created_at is not None


def test_refresh_token_jti_unique(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user)
    db.session.commit()
    soon = datetime.now(timezone.utc) + timedelta(days=30)
    db.session.add(RefreshToken(user_id=user.id, jti="j1", expires_at=soon))
    db.session.commit()
    db.session.add(RefreshToken(user_id=user.id, jti="j1", expires_at=soon))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_refresh_tokens_deleted_with_user(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user)
    db.session.commit()
    db.session.add(RefreshToken(user_id=user.id, jti="j1",
                                expires_at=datetime.now(timezone.utc) + timedelta(days=30)))
    db.session.commit()
    db.session.execute(delete(User))
    db.session.commit()
    assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 0


def test_guest_user_allows_nulls_and_many_guests(app):
    db.session.add_all([User(), User()])
    db.session.commit()
    assert all(user.is_guest for user in db.session.scalars(select(User)))


def test_email_without_password_rejected(app):
    db.session.add(User(name="A", email="a@example.com"))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()


def test_real_user_is_not_guest(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user)
    db.session.commit()
    assert user.is_guest is False
