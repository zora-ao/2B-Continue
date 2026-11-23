from datetime import datetime, timedelta, timezone

from flask import jsonify, session
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from . import auth_bp
from .validation import normalize_email, validate_login, validate_registration
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import User

MAX_FAILED_LOGINS = 5
LOCKOUT = timedelta(minutes=15)
# Checked against when the email is unknown, so the response takes as long as a real check.
DUMMY_HASH = generate_password_hash("not-a-real-password")


def serialize_user(user):
    return {"id": user.id, "name": user.name, "email": user.email}


def start_session(user):
    session.clear()
    session["user_id"] = user.id
    session.permanent = True


@auth_bp.post("/register")
def register():
    values = validate_registration(json_payload())
    user = User(name=values["name"], email=values["email"],
                password_hash=generate_password_hash(values["password"]))
    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="An account with this email already exists."), 409
    start_session(user)
    return jsonify(user=serialize_user(user)), 201


@auth_bp.post("/login")
def login():
    email, password = validate_login(json_payload())
    try:
        user = db.session.scalar(select(User).where(User.email == normalize_email(email)))
    except ValidationError:
        user = None
    if user is None:
        check_password_hash(DUMMY_HASH, password)
        return jsonify(error="Email or password is incorrect."), 401
    now = datetime.now(timezone.utc)
    if user.locked_until and user.locked_until > now:
        return jsonify(error="Too many failed attempts. Try again in 15 minutes."), 429
    if not check_password_hash(user.password_hash, password):
        failures = db.session.execute(
            update(User).where(User.id == user.id)
            .values(failed_login_count=User.failed_login_count + 1)
            .returning(User.failed_login_count)).scalar_one()
        if failures >= MAX_FAILED_LOGINS:
            db.session.execute(update(User).where(User.id == user.id)
                               .values(failed_login_count=0, locked_until=now + LOCKOUT))
        db.session.commit()
        return jsonify(error="Email or password is incorrect."), 401
    user.failed_login_count = 0
    user.locked_until = None
    db.session.commit()
    start_session(user)
    return jsonify(user=serialize_user(user))


@auth_bp.post("/logout")
def logout():
    session.clear()
    return "", 204


@auth_bp.get("/me")
def me():
    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if user_id else None
    if user is None:
        return jsonify(error="Please log in."), 401
    return jsonify(user=serialize_user(user))
