from flask import abort, g, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from sqlalchemy import or_, select

from ...extensions import db
from ...models import Household, HouseholdMember, User

PUBLIC_ENDPOINTS = {"auth.register", "auth.login", "auth.guest", "auth.refresh", "auth.logout",
                    "api.health"}


def household_access(user_id):
    member = select(HouseholdMember.household_id).where(
        HouseholdMember.household_id == Household.id, HouseholdMember.user_id == user_id,
    ).exists()
    return or_(Household.user_id == user_id, member)


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
        accessible = db.session.scalar(select(Household.id).where(
            Household.id == household_id, household_access(user.id)))
        if accessible is None:
            abort(404)
    return None
