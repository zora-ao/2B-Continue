import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import Household, User


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
