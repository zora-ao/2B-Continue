from decimal import Decimal

from sqlalchemy import select

from .estimates import daily_kwh, rounded, serialize
from ...errors import ValidationError
from ...extensions import db
from ...models import Appliance


def get_appliance(household_id, appliance_id):
    return db.one_or_404(select(Appliance).where(
        Appliance.id == appliance_id, Appliance.household_id == household_id))


def list_summary(household, month, days, category):
    if category not in {"all", "must-have", "flexible"}:
        raise ValidationError("category must be all, must-have, or flexible.")
    appliances = db.session.scalars(select(Appliance).where(
        Appliance.household_id == household.id).order_by(Appliance.id)).all()
    visible = [a for a in appliances
               if category == "all" or a.is_must_have == (category == "must-have")]
    total = sum((daily_kwh(a) for a in appliances), Decimal(0))
    essential = sum(a.is_must_have for a in appliances)
    return {
        "items": [serialize(a, days, household.electricity_rate) for a in visible],
        "month": month, "days_in_month": days,
        "electricity_rate": float(household.electricity_rate),
        "counts": {"all": len(appliances), "must-have": essential,
                   "flexible": len(appliances) - essential},
        "totals": {"estimated_daily_kwh": rounded(total),
                   "estimated_monthly_kwh": rounded(total * days),
                   "estimated_monthly_cost": rounded(total * days * household.electricity_rate, "0.01")},
    }


def save_appliance(household_id, values, appliance=None):
    hours = values.get("hours_per_day", appliance.hours_per_day if appliance else Decimal(0))
    standby_hours = values.get("standby_hours_per_day", appliance.standby_hours_per_day if appliance else Decimal(0))
    if hours + standby_hours > 24:
        raise ValidationError("Active and standby hours combined cannot exceed 24 per day.")
    if appliance is None:
        appliance = Appliance(household_id=household_id)
        db.session.add(appliance)
    for field, value in values.items():
        setattr(appliance, field, value)
    db.session.commit()
    return appliance


def remove_appliance(appliance):
    db.session.delete(appliance)
    db.session.commit()
