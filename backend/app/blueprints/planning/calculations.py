from decimal import Decimal, ROUND_DOWN, localcontext

from ...calculations import ZERO, monthly_estimate, output
from ...errors import ValidationError

STEP = Decimal("0.001")


def recommend_hours(appliances, budget, rate, days, style):
    """Never increase baseline hours or reduce must-have usage."""
    hours = {a.id: a.hours_per_day for a in appliances}
    costs = {a.id: a.watts * a.quantity * days * rate / 1000 for a in appliances}
    essential = sum((costs[a.id] * hours[a.id] for a in appliances if a.is_must_have), ZERO)
    flexible = [a for a in appliances if not a.is_must_have]
    target = max(essential, budget * Decimal("0.9")) if style == "strict" else budget
    allowance = max(ZERO, target - essential)
    flexible_cost = sum((costs[a.id] * hours[a.id] for a in flexible), ZERO)
    if flexible_cost <= allowance:
        return hours
    if style == "comfort":
        ratio = allowance / flexible_cost
        for appliance in flexible:
            hours[appliance.id] = (hours[appliance.id] * ratio).quantize(STEP, rounding=ROUND_DOWN)
    else:
        excess = flexible_cost - allowance
        for appliance in sorted(flexible, key=lambda a: (-a.watts * a.quantity, a.id)):
            old_cost = costs[appliance.id] * hours[appliance.id]
            remaining = max(ZERO, old_cost - excess)
            hours[appliance.id] = (remaining / costs[appliance.id]).quantize(STEP, rounding=ROUND_DOWN)
            excess -= old_cost - costs[appliance.id] * hours[appliance.id]
            if excess <= 0:
                break
    return hours


def build_plan(appliances, *, month, days, style, budget, rate, adjustments):
    # Use enough precision for large but valid quantities/rates, then round only for output.
    with localcontext() as ctx:
        ctx.prec = 50
        return _build_plan(appliances, month, days, style, budget, rate, adjustments)


def _build_plan(appliances, month, days, style, budget, rate, adjustments):
    known = {a.id: a for a in appliances}
    if set(adjustments) - known.keys():
        raise ValidationError("An adjusted appliance does not belong to this household.")
    hours = recommend_hours(appliances, budget, rate, days, style)
    for appliance_id, value in adjustments.items():
        appliance = known[appliance_id]
        if appliance.is_must_have and value != appliance.hours_per_day:
            raise ValidationError(f"Must-have appliance {appliance_id} keeps its original hours.")
        hours[appliance_id] = value

    rows = []
    daily = baseline = essential = ZERO
    for appliance in appliances:
        power = appliance.watts * appliance.quantity / 1000
        usage = power * hours[appliance.id]
        original = power * appliance.hours_per_day
        daily += usage
        baseline += original
        if appliance.is_must_have:
            essential += original
        rows.append({
            "appliance_id": appliance.id, "name": appliance.name,
            "appliance_type": appliance.appliance_type, "watts": float(appliance.watts),
            "quantity": appliance.quantity, "is_must_have": appliance.is_must_have,
            "max_hours_per_day": float(24 - appliance.standby_hours_per_day),
            "original_hours_per_day": float(appliance.hours_per_day),
            "hours_per_day": float(hours[appliance.id]),
            "is_reduced": hours[appliance.id] < appliance.hours_per_day,
            "estimated_daily_kwh": output(usage),
            **monthly_estimate(usage, days, rate),
        })
    monthly = daily * days
    allowance = budget / rate
    cost = monthly * rate
    essential_cost = essential * days * rate
    fits = cost <= budget
    warnings = []
    if essential_cost > budget:
        warnings.append("Must-have appliances alone exceed the budget. Increase the budget or review their usage on the Appliances page.")
    elif not fits:
        warnings.append("Adjusted usage exceeds the budget. Reduce flexible appliance hours or increase the budget.")
    if not appliances:
        warnings.append("Add appliances to generate a useful usage plan.")
    return {
        "month": month, "days_in_month": days, "style": style,
        "monthly_budget": float(budget), "electricity_rate": float(rate),
        "fits_budget": fits, "status": "fits_budget" if fits else "over_budget",
        "allowance": {"monthly_kwh": output(allowance),
                      "daily_kwh": output(allowance / days),
                      "daily_budget": output(budget / days, "0.01")},
        "items": rows,
        "totals": {"estimated_daily_kwh": output(daily),
                   **monthly_estimate(daily, days, rate),
                   "original_monthly_cost": output(baseline * days * rate, "0.01"),
                   "estimated_monthly_savings": output((baseline - daily) * days * rate, "0.01"),
                   "remaining_budget": output(budget - cost, "0.01"),
                   "over_budget_by": output(max(ZERO, cost - budget), "0.01"),
                   "must_have_monthly_cost": output(essential_cost, "0.01")},
        "warnings": warnings, "tips": tips_for(appliances),
    }


def tips_for(appliances):
    tips = [{"id": "idle_devices", "title": "Switch off idle devices",
             "description": "Switch off devices when unused. Keep essential appliances running as needed."}]
    if any((a.appliance_type or "").lower().startswith("aircon") for a in appliances):
        tips.append({"id": "aircon", "title": "Review aircon settings",
                     "description": "Use a comfortable thermostat setting and keep doors and windows closed."})
    tips.append({"id": "usage", "title": "Compare estimates with your bill",
                 "description": "Adjust daily hours to reflect actual habits. Fixed charges and appliance cycling can change your bill."})
    return tips
