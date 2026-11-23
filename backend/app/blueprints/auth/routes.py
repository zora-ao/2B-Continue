from flask import jsonify, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from . import auth_bp
from .validation import validate_registration
from ...errors import json_payload
from ...extensions import db
from ...models import User


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
