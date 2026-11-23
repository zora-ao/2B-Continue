from calendar import monthrange
from datetime import date, datetime, timedelta
from decimal import Decimal, localcontext
from zoneinfo import ZoneInfo

from ...errors import ValidationError
from ...calculations import ZERO, monthly_estimate, output, percentage
from ..appliances.estimates import daily_kwh

DAY = timedelta(days=1)


def today():
    return datetime.now(ZoneInfo("Asia/Manila")).date()


def selected_month(value):
    current_date = today()
    value = value if value is not None else current_date.strftime("%Y-%m")
    try:
        first = date.fromisoformat(value + "-01")
        if first.strftime("%Y-%m") != value or first.year < 2000 or first > current_date:
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError("month must be YYYY-MM between 2000-01 and the current Manila month.") from None
    end = first.replace(day=monthrange(first.year, first.month)[1])
    return first, end, min(end, current_date)


def month_before(first, count):
    index = first.year * 12 + first.month - 1 - count
    return date(index // 12, index % 12 + 1, 1)


def daily_usage(readings):
    """Never treat cumulative counters, baselines, or gaps as one day's usage."""
    by_date = {r.date: r for r in readings}
    values = {}
    for reading in readings:
        if reading.consumption_kwh is not None:
            values[reading.date] = reading.consumption_kwh
        else:
            previous = by_date.get(reading.date - DAY)
            if previous is not None and previous.meter_reading_kwh is not None:
                difference = reading.meter_reading_kwh - previous.meter_reading_kwh
                if difference >= 0:
                    values[reading.date] = difference
    return values


def chart(values, first, end, as_of, period, allowance):
    daily_limit = allowance / end.day
    if period == "day":
        ranges = [(as_of - DAY * n, as_of - DAY * n) for n in range(13, -1, -1)]
    elif period == "week":
        monday = as_of - DAY * as_of.weekday()
        ranges = [(monday - DAY * (7 * n), min(monday - DAY * (7 * n) + DAY * 6, as_of))
                  for n in range(7, -1, -1)]
    else:
        ranges = []
        for n in range(11, -1, -1):
            start = month_before(first, n)
            stop = min(start.replace(day=monthrange(start.year, start.month)[1]), as_of)
            ranges.append((start, stop))
    points = []
    for start, stop in ranges:
        covered = [v for d, v in values.items() if start <= d <= stop]
        expected = (stop - start).days + 1
        usage = sum(covered, ZERO) if covered else None
        limit = allowance if period == "month" else daily_limit * expected
        complete = len(covered) == expected
        points.append({"start_date": start.isoformat(), "end_date": stop.isoformat(),
                       "kwh": output(usage),
                       "limit_kwh": output(limit), "logged_days": len(covered),
                       "expected_days": expected,
                       "coverage": "complete" if complete else "partial" if covered else "no_data",
                       "over_limit": (usage > limit if complete or usage is not None and usage > limit
                                      else None)})
    return {"period": period, "budget_basis_month": first.strftime("%Y-%m"), "points": points}


def overview(household, appliances, readings, solar, first, end, as_of, period, settings):
    with localcontext() as context:
        context.prec = 50
        return _overview(household, appliances, readings, solar, first, end, as_of, period, settings)


def _overview(household, appliances, readings, solar, first, end, as_of, period, settings):
    current_date = today()
    rate, budget = settings["rate"], settings["budget"]
    values = daily_usage(readings)
    recorded = {d: v for d, v in values.items() if first <= d <= as_of}
    consumption = sum(recorded.values(), ZERO) if recorded else None
    spent = consumption * rate if consumption is not None else None
    allowance = budget / rate
    daily_limit = allowance / end.day
    projected = consumption / len(recorded) * end.day * rate if recorded else None
    remaining = budget - spent if spent is not None else None
    days_left = ((end - as_of).days + int(as_of not in recorded)) if (first.year, first.month) == (current_date.year, current_date.month) else 0
    status = "no_data" if spent is None else "over_budget" if spent > budget else "projected_over_budget" if projected > budget else "on_track"
    breakdown = []
    estimates = [(a, daily_kwh(a)) for a in appliances]
    baseline = sum((usage for _, usage in estimates), ZERO)
    for appliance, usage in sorted(estimates, key=lambda item: (-item[1], item[0].id)):
        breakdown.append({"appliance_id": appliance.id, "name": appliance.name,
                          "appliance_type": appliance.appliance_type,
                          "watts": float(appliance.watts), "quantity": appliance.quantity,
                          "hours_per_day": float(appliance.hours_per_day),
                          **monthly_estimate(usage, end.day, rate),
                          "percentage": percentage(usage, baseline) if baseline else 0})
    alerts = build_alerts(recorded, values, appliances, projected, budget, daily_limit, rate, end.day)
    day_usage = recorded.get(as_of)
    current = as_of == current_date
    result = {
        "household_id": household.id, "month": first.strftime("%Y-%m"),
        "as_of": as_of.isoformat(), "timezone": "Asia/Manila", "days_in_month": end.day,
        "electricity_rate": float(rate), "monthly_budget": float(budget),
        "settings_source": settings["source"], "saved_plan_is_stale": settings["is_stale"],
        "usage": {"today_kwh": output(day_usage) if current else None,
                  "as_of_day_kwh": output(day_usage),
                  "daily_limit_kwh": output(daily_limit),
                  "month_kwh": output(consumption),
                  "monthly_allowance_kwh": output(allowance),
                  "allowance_used_percent": percentage(consumption, allowance),
                  "logged_days": len(recorded), "elapsed_days": as_of.day,
                  "coverage": "complete" if len(recorded) == as_of.day else "partial" if recorded else "no_data"},
        "budget": {"status": status, "spent": output(spent, "0.01"),
                   "spent_percent": percentage(spent, budget),
                   "remaining": output(remaining, "0.01"),
                   "days_left": days_left,
                   "safe_to_spend_per_day": output(max(ZERO, remaining) / days_left, "0.01") if remaining is not None and days_left else None,
                   "projected_bill": output(projected, "0.01"),
                   "projection_method": "average_logged_day_times_days_in_month" if projected is not None else None},
        "solar": {"today_kwh": float(solar.generation_kwh) if current and solar else None,
                  "as_of_day_kwh": float(solar.generation_kwh) if solar else None,
                  "estimated_savings": output(solar.self_consumed_kwh * rate, "0.01") if solar and solar.self_consumed_kwh is not None else None,
                  "source": "manual" if solar else "unavailable"},
        "chart": chart(values, first, end, as_of, period, allowance),
        "appliance_breakdown": {"source": "manual_appliance_estimates", "items": breakdown},
        "alerts": alerts[:3], "alert_count": len(alerts),
    }
    return result, alerts


def build_alerts(recorded, history, appliances, projected, budget, daily_limit, rate, days):
    alerts = []
    if projected is not None and projected > budget:
        alerts.append({"id": "projected_budget", "type": "budget", "severity": "warning",
                       "title": "Projected bill exceeds your budget",
                       "projected_bill": output(projected, "0.01"),
                       "over_budget_by": output(projected - budget, "0.01")})
    if recorded:
        latest = max(recorded)
        usage = recorded[latest]
        if usage > daily_limit:
            alerts.append({"id": "daily_limit", "type": "consumption", "severity": "warning",
                           "title": "Latest logged usage exceeds your daily limit", "date": latest.isoformat(),
                           "kwh": output(usage), "limit_kwh": output(daily_limit)})
        previous = [v for d, v in sorted(history.items(), reverse=True)
                    if latest - DAY * 14 <= d < latest][:7]
        if len(previous) >= 3:
            average = sum(previous, ZERO) / len(previous)
            if usage > average * Decimal("1.15"):
                alerts.append({"id": "unusual_usage", "type": "consumption", "severity": "warning",
                               "title": "Latest usage is unusually high", "date": latest.isoformat(),
                               "kwh": output(usage), "average_kwh": output(average),
                               "percent_above_average": output((usage / average - 1) * 100, "0.1") if average else None})
    if appliances:
        biggest = max(appliances, key=lambda a: (daily_kwh(a), -a.id))
        if biggest.hours_per_day > 0:
            alert = {"id": "biggest_cost", "type": "appliance", "severity": "info",
                     "title": f"{biggest.name} has the highest estimated consumption",
                     "appliance_id": biggest.id, "source": "manual_appliance_estimate"}
            if not biggest.is_must_have:
                reduction = min(Decimal(1), biggest.hours_per_day)
                alert["reduce_hours_per_day"] = float(reduction)
                alert["estimated_monthly_savings"] = output(biggest.watts * biggest.quantity * reduction / 1000 * rate * days, "0.01")
            alerts.append(alert)
    return alerts
