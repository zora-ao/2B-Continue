from datetime import timedelta
from decimal import Decimal, localcontext

from .catalog import (AVERAGE_MONTH_DAYS, FULL_COVERAGE, LOW_OUTPUT_RATIO, PERFORMANCE_RATIO,
                      SYSTEMS)
from ..planning.calculations import output

ZERO = Decimal(0)
DAY = timedelta(days=1)
MIN_LOGGED_DAYS = 7


def _money(value):
    return output(value, "0.01") if value is not None else None


def _kwh(value):
    return output(value) if value is not None else None


def _percent(value):
    return output(value, "0.1") if value is not None else None


def monthly_usage(meter_usage, appliances):
    """Typical monthly household consumption, preferring real readings over estimates."""
    if len(meter_usage) >= MIN_LOGGED_DAYS:
        daily = sum(meter_usage.values(), ZERO) / len(meter_usage)
        return daily * AVERAGE_MONTH_DAYS, "meter_readings", len(meter_usage)
    if appliances:
        daily = sum((a.watts * a.quantity * a.hours_per_day / 1000 for a in appliances), ZERO)
        return daily * AVERAGE_MONTH_DAYS, "appliance_estimates", len(meter_usage)
    return None, "unavailable", len(meter_usage)


def recommendations(sun_hours, usage, rate, install_budget):
    with localcontext() as context:
        context.prec = 50
        return _recommendations(sun_hours, usage, rate, install_budget)


def _recommendations(sun_hours, usage, rate, install_budget):
    rows = []
    for system in SYSTEMS:
        kw, cost = Decimal(system["kw"]), Decimal(system["estimated_cost"])
        generation = kw * sun_hours * AVERAGE_MONTH_DAYS * PERFORMANCE_RATIO
        # Excess generation is not credited: net-metering export rates vary.
        offset = min(generation, usage) if usage is not None else generation
        savings = offset * rate
        coverage = min(generation / usage, Decimal(1)) if usage else None
        rows.append({
            "system_kw": float(kw), "panel_count": system["panel_count"],
            "panel_watts": system["panel_watts"],
            "estimated_cost": _money(cost),
            "monthly_generation_kwh": _kwh(generation),
            "monthly_savings": _money(savings),
            "payback_years": output(cost / (savings * 12), "0.1") if savings > 0 else None,
            "covers_percent": _percent(coverage * 100) if coverage is not None else None,
            "excess_kwh": _kwh(max(ZERO, generation - usage)) if usage is not None else None,
            "within_budget": install_budget is None or cost <= install_budget,
            "_coverage": coverage, "_kw": kw,
        })

    affordable = [r for r in rows if r["within_budget"]]
    best = None
    if affordable:
        covering = [r for r in affordable if r["_coverage"] is not None and r["_coverage"] >= FULL_COVERAGE]
        best = min(covering, key=lambda r: r["_kw"]) if covering else max(affordable, key=lambda r: r["_kw"])
    for row in rows:
        row["status"] = ("best_fit" if row is best else
                         "available" if row["within_budget"] else "over_budget")
        row["is_best_fit"] = row is best
        del row["_coverage"], row["_kw"]
    return rows


def week_performance(system_kw, location_sun_hours, weather, logs, monday, today):
    with localcontext() as context:
        context.prec = 50
        return _week_performance(system_kw, location_sun_hours, weather, logs, monday, today)


def expected_output(system_kw, sun_hours):
    return system_kw * sun_hours * PERFORMANCE_RATIO


def _week_performance(system_kw, location_sun_hours, weather, logs, monday, today):
    days, alerts = [], []
    for offset in range(7):
        day = monday + DAY * offset
        conditions = (weather or {}).get(day)
        sun_hours = conditions["sun_hours"] if conditions else location_sun_hours
        expected = expected_output(system_kw, sun_hours)
        log = logs.get(day)
        actual = log.generation_kwh if log else None
        ratio = actual / expected if actual is not None and expected > 0 else None
        sunny = conditions["sunny"] if conditions else None
        # Expected output already reflects that day's measured sunlight, so a low ratio
        # points to the panels. Today is skipped: a mid-day log would look like a failure.
        low = ratio is not None and day < today and ratio < LOW_OUTPUT_RATIO
        days.append({
            "date": day.isoformat(), "weekday": day.strftime("%a"),
            "actual_kwh": _kwh(actual), "expected_kwh": _kwh(expected),
            "percent_of_expected": _percent(ratio * 100) if ratio is not None else None,
            "expected_source": "open_meteo" if conditions else "location_average",
            "sunny": sunny, "is_future": day > today, "low_output": low,
        })
        if low:
            percent = output(ratio * 100, "1")
            if sunny:
                reason = "Output was well below expected on a sunny day."
            elif conditions:
                reason = "Output was well below expected for that day's weather."
            else:
                reason = ("Output was well below the typical expected output "
                          "(live weather was unavailable, so clouds may explain it).")
            alerts.append({
                "id": f"low_output_{day.isoformat()}", "type": "solar", "severity": "danger",
                "title": f"{day.strftime('%A')} dropped to {percent:g}%",
                "message": f"{reason} Check for dirt, shade, or a tripped breaker.",
                "date": day.isoformat(), "percent_of_expected": _percent(ratio * 100),
                "actual_kwh": _kwh(actual), "expected_kwh": _kwh(expected),
            })
    return days, alerts


def month_savings(logs, grid_usage, rate):
    """Avoided grid cost this month from solar logs.

    Self-consumed kWh are used when logged; otherwise all generation is assumed
    to be used at home. The bill reduction compares savings with grid-meter cost
    only on days that have both a solar log and known grid usage.
    """
    with localcontext() as context:
        context.prec = 50
        offset_total, saved_on_metered, grid_on_metered = ZERO, ZERO, ZERO
        self_consumed_days = assumed_days = metered_days = 0
        for day, log in logs.items():
            if log.self_consumed_kwh is not None:
                offset, self_consumed_days = log.self_consumed_kwh, self_consumed_days + 1
            else:
                offset, assumed_days = log.generation_kwh, assumed_days + 1
            offset_total += offset
            if day in grid_usage:
                metered_days += 1
                saved_on_metered += offset
                grid_on_metered += grid_usage[day]
        total = saved_on_metered + grid_on_metered
        return {
            "amount": _money(offset_total * rate) if logs else None,
            "offset_kwh": _kwh(offset_total) if logs else None,
            "bill_reduced_percent": _percent(saved_on_metered / total * 100) if metered_days and total else None,
            "logged_days": len(logs), "self_consumed_days": self_consumed_days,
            "generation_assumed_days": assumed_days, "days_compared_with_meter": metered_days,
        }
