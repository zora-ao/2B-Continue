from datetime import datetime, timedelta, timezone

from flask import jsonify, request
from flask_jwt_extended import (create_access_token, create_refresh_token, decode_token,
                                set_access_cookies, set_refresh_cookies)

from ...extensions import db
from ...models import RefreshToken

ACCESS_LIFETIME = timedelta(minutes=15)
REFRESH_LIFETIME = timedelta(days=30)
REFRESH_GRACE = timedelta(seconds=30)
COOKIE_MAX_AGE = int(REFRESH_LIFETIME.total_seconds())


def serialize_user(user):
    return {"id": user.id, "name": user.name, "email": user.email}


def wants_mobile():
    return request.headers.get("X-Client") == "mobile"


def issue_tokens(user):
    access = create_access_token(identity=str(user.id))
    refresh = create_refresh_token(identity=str(user.id))
    db.session.add(RefreshToken(user_id=user.id, jti=decode_token(refresh)["jti"],
                                expires_at=datetime.now(timezone.utc) + REFRESH_LIFETIME))
    return access, refresh


def token_response(user, access, refresh, *, mobile, status=200):
    if mobile:
        return jsonify(user=serialize_user(user), access_token=access,
                       refresh_token=refresh), status
    response = jsonify(user=serialize_user(user))
    set_access_cookies(response, access, max_age=COOKIE_MAX_AGE)
    set_refresh_cookies(response, refresh, max_age=COOKIE_MAX_AGE)
    return response, status


def please_log_in(*args):
    return jsonify(error="Please log in."), 401


def register_jwt_errors(jwt):
    for loader in (jwt.unauthorized_loader, jwt.invalid_token_loader, jwt.expired_token_loader,
                   jwt.revoked_token_loader, jwt.needs_fresh_token_loader,
                   jwt.token_verification_failed_loader, jwt.user_lookup_error_loader):
        loader(please_log_in)
