from decimal import Decimal, InvalidOperation

from flask import g, jsonify
from sqlalchemy import select

from . import households_bp
from .sharing import issue_invite, redeem_invite
from ..auth.guard import household_access
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Household


def serialize(household):
    return {"id": household.id, "name": household.name,
            "is_owner": household.user_id == g.user.id,
            "electricity_rate": float(household.electricity_rate),
            "monthly_budget": float(household.monthly_budget)}


@households_bp.get("")
def list_households():
    households = db.session.scalars(select(Household).where(household_access(g.user.id))
                                    .order_by(Household.id)).all()
    return jsonify(items=[serialize(h) for h in households])


@households_bp.post("")
def create_household():
    data = json_payload()
    if set(data) - {"name", "electricity_rate", "monthly_budget"}:
        raise ValidationError("Only name, electricity_rate, and monthly_budget are accepted.")
    name = data.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        raise ValidationError("Household name must contain 1-120 characters.")
    values = {"name": name.strip()}
    for field, scale, minimum in (("electricity_rate", 4, Decimal("0.0001")),
                                   ("monthly_budget", 2, Decimal(0))):
        try:
            value = Decimal(str(data.get(field)))
            maximum = Decimal(10) ** (12 - scale) - Decimal(10) ** -scale
            if not value.is_finite() or not minimum <= value <= maximum:
                raise ValueError
            if value != value.quantize(Decimal(10) ** -scale):
                raise ValueError
        except (InvalidOperation, ValueError):
            raise ValidationError(f"Invalid {field}; use up to {scale} decimal places.") from None
        values[field] = value
    household = Household(**values, user_id=g.user.id)
    db.session.add(household)
    db.session.commit()
    return jsonify(item=serialize(household)), 201


@households_bp.post("/<int:household_id>/invites")
def create_invite(household_id):
    if g.user.is_guest:
        return jsonify(error="Sign in to share a household."), 403
    return issue_invite(household_id, g.user.id)


@households_bp.delete("/<int:household_id>")
def delete_household(household_id):
    household = db.one_or_404(select(Household).where(
        Household.id == household_id, Household.user_id == g.user.id,
    ).with_for_update())
    db.session.delete(household)
    db.session.commit()
    return "", 204


@households_bp.post("/join")
def join_household():
    if g.user.is_guest:
        return jsonify(error="Sign in to join a household."), 403
    household, error = redeem_invite(g.user.id, json_payload().get("pin"))
    if error:
        message, status = error
        return jsonify(error=message), status
    return jsonify(item=serialize(household))
