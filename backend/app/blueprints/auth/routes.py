from datetime import datetime, timedelta, timezone

from flask import g, jsonify, make_response
from flask_jwt_extended import (get_jwt, get_jwt_request_location, unset_jwt_cookies,
                                verify_jwt_in_request)
from flask_jwt_extended.exceptions import JWTExtendedException
from jwt.exceptions import PyJWTError
from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from . import auth_bp
from .guests import create_guest, delete_abandoned_guests, merge_guest_into, recognise_guest
from .tokens import (REFRESH_GRACE, issue_tokens, prune_refresh_tokens, serialize_user,
                     token_response, wants_mobile)
from .validation import normalize_email, validate_login, validate_registration
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import RefreshToken, User

MAX_FAILED_LOGINS = 5
LOCKOUT = timedelta(minutes=15)
# Checked against when the email is unknown, so the response takes as long as a real check.
DUMMY_HASH = generate_password_hash("not-a-real-password")


@auth_bp.post("/register")
def register():
    values = validate_registration(json_payload())
    password_hash = generate_password_hash(values["password"])
    guest, location = recognise_guest()
    if guest is not None:
        guest.name, guest.email, guest.password_hash = values["name"], values["email"], password_hash
        user, status, mobile = guest, 200, location == "headers"
    else:
        user = User(name=values["name"], email=values["email"], password_hash=password_hash)
        db.session.add(user)
        status, mobile = 201, wants_mobile()
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="An account with this email already exists."), 409
    if guest is not None:
        # The old guest session ends; only the tokens issued below stay valid.
        db.session.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    access, refresh = issue_tokens(user)
    db.session.commit()
    return token_response(user, access, refresh, mobile=mobile, status=status)


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
    guest, location = recognise_guest()
    if guest is not None and guest.id != user.id:
        merge_guest_into(guest, user)
    mobile = location == "headers" if guest is not None else wants_mobile()
    prune_refresh_tokens(user.id)
    access, refresh = issue_tokens(user)
    db.session.commit()
    return token_response(user, access, refresh, mobile=mobile)


@auth_bp.post("/guest")
def guest():
    delete_abandoned_guests()
    user = create_guest()
    access, refresh = issue_tokens(user)
    db.session.commit()
    return token_response(user, access, refresh, mobile=wants_mobile(), status=201)


@auth_bp.post("/refresh")
def refresh():
    verify_jwt_in_request(refresh=True)
    row = db.session.scalar(select(RefreshToken).where(RefreshToken.jti == get_jwt()["jti"])
                            .with_for_update())
    if row is None:
        return jsonify(error="Please log in."), 401
    now = datetime.now(timezone.utc)
    if row.used_at is not None:
        if now - row.used_at <= REFRESH_GRACE:
            return jsonify(error="Refresh already used."), 409
        db.session.execute(delete(RefreshToken).where(RefreshToken.user_id == row.user_id))
        db.session.commit()
        return jsonify(error="Please log in."), 401
    user = db.session.get(User, row.user_id)
    if user is None:
        return jsonify(error="Please log in."), 401
    row.used_at = now
    prune_refresh_tokens(user.id)
    access, refresh_token = issue_tokens(user)
    db.session.commit()
    return token_response(user, access, refresh_token,
                          mobile=get_jwt_request_location() == "headers")


@auth_bp.post("/logout")
def logout():
    try:
        if verify_jwt_in_request(refresh=True, optional=True):
            db.session.execute(delete(RefreshToken).where(RefreshToken.jti == get_jwt()["jti"]))
            db.session.commit()
    except (JWTExtendedException, PyJWTError):
        pass
    response = make_response("", 204)
    unset_jwt_cookies(response)
    return response


@auth_bp.get("/me")
def me():
    return jsonify(user=serialize_user(g.user))
