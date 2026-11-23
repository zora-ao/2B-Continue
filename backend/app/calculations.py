"""Shared decimal formatting and energy estimate fields."""
from decimal import Decimal, ROUND_HALF_UP, localcontext

ZERO = Decimal(0)


def output(value, places="0.001"):
    if value is None:
        return None
    with localcontext() as ctx:
        ctx.prec = 50
        return float(value.quantize(Decimal(places), rounding=ROUND_HALF_UP))


def percentage(value, total):
    return output(value / total * 100, "0.1") if value is not None and total else None


def monthly_estimate(daily, days, rate):
    monthly = daily * days
    return {
        "estimated_monthly_kwh": output(monthly),
        "estimated_monthly_cost": output(monthly * rate, "0.01"),
    }
