from decimal import Decimal, InvalidOperation

from flask import jsonify
from sqlalchemy import select

from . import households_bp
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Household


def serialize(household):
    return {"id": household.id, "name": household.name,
            "electricity_rate": float(household.electricity_rate),
            "monthly_budget": float(household.monthly_budget)}


@households_bp.get("")
def list_households():
    households = db.session.scalars(select(Household).order_by(Household.id)).all()
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
    household = Household(**values)
    db.session.add(household)
    db.session.commit()
    return jsonify(item=serialize(household)), 201
