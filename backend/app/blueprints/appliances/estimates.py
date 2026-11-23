from calendar import monthrange
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from ...errors import ValidationError


def estimate_period(month):
    if month is None:
        month = datetime.now(ZoneInfo("Asia/Manila")).strftime("%Y-%m")
    try:
        date = datetime.strptime(month, "%Y-%m")
        if date.strftime("%Y-%m") != month:
            raise ValueError
    except (ValueError, TypeError):
        raise ValidationError("month must use YYYY-MM, for example 2026-11.") from None
    return month, monthrange(date.year, date.month)[1]


def daily_kwh(appliance):
    return appliance.watts * appliance.quantity * appliance.hours_per_day / Decimal(1000)


def rounded(value, places="0.001"):
    return float(value.quantize(Decimal(places), rounding=ROUND_HALF_UP))


def serialize(appliance, days, rate):
    daily = daily_kwh(appliance)
    monthly = daily * days
    return {
        "id": appliance.id, "household_id": appliance.household_id,
        "name": appliance.name, "appliance_type": appliance.appliance_type,
        "room": appliance.room, "watts": float(appliance.watts),
        "quantity": appliance.quantity, "hours_per_day": float(appliance.hours_per_day),
        "standby_watts": float(appliance.standby_watts) if appliance.standby_watts is not None else None,
        "standby_hours_per_day": float(appliance.standby_hours_per_day),
        "is_must_have": appliance.is_must_have,
        "category": "must-have" if appliance.is_must_have else "flexible",
        "estimated_daily_kwh": rounded(daily),
        "estimated_monthly_kwh": rounded(monthly),
        "estimated_monthly_cost": rounded(monthly * rate, "0.01"),
    }
