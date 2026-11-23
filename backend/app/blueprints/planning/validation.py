from decimal import Decimal, InvalidOperation

from ...errors import ValidationError
from ..appliances.estimates import estimate_period

STYLES = ("strict", "balanced", "comfort")


def number(value, field, *, maximum, scale, positive=False):
    try:
        result = Decimal(str(value))
        if not result.is_finite() or result < 0 or result > Decimal(maximum):
            raise ValueError
        if positive and result == 0:
            raise ValueError
        if result != result.quantize(Decimal(10) ** -scale):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError(f"Invalid {field}; use a {'positive' if positive else 'nonnegative'} "
                              f"number with up to {scale} decimal places.") from None
    return result


def validate_request(data, household):
    unknown = set(data) - {"month", "monthly_budget", "electricity_rate", "style", "adjustments"}
    if unknown:
        raise ValidationError("Unknown fields: " + ", ".join(sorted(unknown)))
    month, days = estimate_period(data.get("month"))
    style = data.get("style", "balanced")
    if not isinstance(style, str) or style not in STYLES:
        raise ValidationError("style must be strict, balanced, or comfort.")
    budget = number(data.get("monthly_budget", household.monthly_budget), "monthly_budget",
                    maximum="9999999999.99", scale=2)
    rate = number(data.get("electricity_rate", household.electricity_rate), "electricity_rate",
                  maximum="99999999.9999", scale=4, positive=True)
    adjustments = data.get("adjustments", [])
    if not isinstance(adjustments, list):
        raise ValidationError("adjustments must be a list of appliance_id and hours_per_day objects.")
    hours = {}
    for adjustment in adjustments:
        if not isinstance(adjustment, dict) or set(adjustment) != {"appliance_id", "hours_per_day"}:
            raise ValidationError("Each adjustment needs only appliance_id and hours_per_day.")
        appliance_id = adjustment["appliance_id"]
        if type(appliance_id) is not int or appliance_id <= 0 or appliance_id in hours:
            raise ValidationError("Adjustment appliance IDs must be positive integers without duplicates.")
        hours[appliance_id] = number(adjustment["hours_per_day"], "hours_per_day",
                                      maximum="24", scale=3)
    return {"month": month, "days": days, "style": style,
            "budget": budget, "rate": rate, "adjustments": hours}
