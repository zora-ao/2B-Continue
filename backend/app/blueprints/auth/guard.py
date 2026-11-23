from flask import abort, g, jsonify, request, session
from sqlalchemy import select

from ...extensions import db
from ...models import Household, User

PUBLIC_ENDPOINTS = {"auth.register", "auth.login", "auth.logout", "api.health"}


def require_login():
    if not request.path.startswith("/api"):
        return None
    if request.method == "OPTIONS" or request.endpoint in PUBLIC_ENDPOINTS:
        return None
    user_id = session.get("user_id")
    user = db.session.get(User, user_id) if isinstance(user_id, int) else None
    if user is None:
        session.clear()
        return jsonify(error="Please log in."), 401
    g.user = user
    household_id = (request.view_args or {}).get("household_id")
    if household_id is not None:
        owned = db.session.scalar(select(Household.id).where(
            Household.id == household_id, Household.user_id == user.id))
        if owned is None:
            abort(404)
    return None
