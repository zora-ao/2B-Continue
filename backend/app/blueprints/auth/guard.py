from flask import abort, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import select

from ...extensions import db
from ...models import Household, User

PUBLIC_ENDPOINTS = {"auth.register", "auth.login", "auth.guest", "auth.refresh", "auth.logout",
                    "api.health"}


def require_login():
    if not request.path.startswith("/api"):
        return None
    if request.method == "OPTIONS" or request.endpoint in PUBLIC_ENDPOINTS:
        return None
    verify_jwt_in_request()
    user = db.session.get(User, int(get_jwt_identity()))
    if user is None:
        return jsonify(error="Please log in."), 401
    g.user = user
    household_id = (request.view_args or {}).get("household_id")
    if household_id is not None:
        owned = db.session.scalar(select(Household.id).where(
            Household.id == household_id, Household.user_id == user.id))
        if owned is None:
            abort(404)
    return None
