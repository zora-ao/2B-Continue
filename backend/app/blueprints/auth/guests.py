from datetime import datetime, timezone

from flask import current_app, request
from flask_jwt_extended import decode_token
from flask_jwt_extended.exceptions import JWTExtendedException
from jwt.exceptions import PyJWTError
from sqlalchemy import delete, exists, select, update

from ...extensions import db
from ...models import Appliance, Household, RefreshToken, User

GUEST_CLEANUP_BATCH = 50


def create_guest():
    guest = User()
    db.session.add(guest)
    db.session.flush()
    return guest


def delete_abandoned_guests(limit=GUEST_CLEANUP_BATCH):
    now = datetime.now(timezone.utc)
    usable_token = exists().where(RefreshToken.user_id == User.id,
                                  RefreshToken.expires_at > now,
                                  RefreshToken.used_at.is_(None))
    guest_ids = db.session.scalars(
        select(User.id).where(User.email.is_(None), ~usable_token)
        .order_by(User.created_at).limit(limit)
        # Lock the guests; skip any a register/login is upgrading or merging right now.
        .with_for_update(skip_locked=True)).all()
    if not guest_ids:
        return 0
    households = select(Household.id).where(Household.user_id.in_(guest_ids))
    # Appliances have no ON DELETE CASCADE in the database, so remove them first.
    db.session.execute(delete(Appliance).where(Appliance.household_id.in_(households)))
    db.session.execute(delete(Household).where(Household.user_id.in_(guest_ids)))
    db.session.execute(delete(User).where(User.id.in_(guest_ids), User.email.is_(None)))
    return len(guest_ids)


def _read_access_token():
    cookie = request.cookies.get(current_app.config["JWT_ACCESS_COOKIE_NAME"])
    if cookie:
        csrf = request.headers.get(current_app.config["JWT_ACCESS_CSRF_HEADER_NAME"])
        # decode_token skips the CSRF check when no value is given, so a missing header means no guest.
        return (cookie, csrf, "cookies") if csrf else (None, None, None)
    scheme, _, value = request.headers.get("Authorization", "").partition(" ")
    if scheme == "Bearer" and value:
        return value, None, "headers"
    return None, None, None


def recognise_guest():
    token, csrf, location = _read_access_token()
    if token is None:
        return None, None
    try:
        claims = decode_token(token, csrf_value=csrf, allow_expired=True)
        if claims["type"] != "access":
            return None, None
        # Lock the row so cleanup or a second register can't change it underneath us.
        user = db.session.get(User, int(claims["sub"]), with_for_update=True,
                              populate_existing=True)
    except (JWTExtendedException, PyJWTError, ValueError, KeyError):
        return None, None
    if user is None or not user.is_guest:
        return None, None
    return user, location


def merge_guest_into(guest, account):
    db.session.execute(update(Household).where(Household.user_id == guest.id)
                       .values(user_id=account.id))
    db.session.execute(delete(User).where(User.id == guest.id, User.email.is_(None)))
