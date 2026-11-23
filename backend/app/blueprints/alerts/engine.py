"""Rule evaluation and event reconciliation; callers own the transaction."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal, localcontext

from sqlalchemy import select

from ...calculations import ZERO, output, percentage
from ...extensions import db
from ...models import Alert, AlertRules, Appliance, BudgetPlan, Household, MeterReading, SolarGeneration
from ..dashboard.calculations import daily_usage, selected_month, today
from ..appliances.estimates import daily_kwh

DEFAULTS = {"daily_limit_exceeded": True, "bill_over_budget": True,
            "unusual_spike": True, "wasteful_appliances": True,
            "solar_underperforming": True, "weekly_summary": False}
CATEGORIES = ("budget", "usage", "appliances", "solar")
DAY = timedelta(days=1)


def get_rules(household_id):
    row = db.session.get(AlertRules, household_id)
    return {name: getattr(row, name) for name in DEFAULTS} if row else DEFAULTS.copy()


def settings(household, month):
    saved = db.session.scalar(select(BudgetPlan).where(
        BudgetPlan.household_id == household.id, BudgetPlan.month == month))
    if saved:
        return Decimal(str(saved.snapshot["monthly_budget"])), Decimal(str(saved.snapshot["electricity_rate"]))
    return household.monthly_budget, household.electricity_rate


def candidates(household, month, rules):
    with localcontext() as context:
        context.prec = 50
        return _candidates(household, month, rules)


def _candidates(household, month, rules):
    first, end, as_of = selected_month(month)
    month = first.strftime("%Y-%m")
    budget, rate = settings(household, month)
    limit = budget / rate / end.day
    readings = db.session.scalars(select(MeterReading).where(
        MeterReading.household_id == household.id,
        MeterReading.date >= first - DAY * 15, MeterReading.date <= as_of)
        .order_by(MeterReading.date)).all()
    history = daily_usage(readings)
    recorded = {d: v for d, v in history.items() if first <= d <= as_of}
    appliances = db.session.scalars(select(Appliance).where(
        Appliance.household_id == household.id).order_by(Appliance.id)).all()
    events = []

    def emit(key, rule, category, severity, title, message, occurred_on, details, action=None):
        if rules[rule]:
            events.append(dict(event_key=key, rule=rule, category=category, severity=severity,
                               title=title, message=message, occurred_on=occurred_on,
                               details=details, action=action, month=month))

    if recorded:
        projected = sum(recorded.values(), ZERO) / len(recorded) * end.day * rate
        if projected > budget:
            emit(f"budget:{month}", "bill_over_budget", "budget", "danger",
                 "Projected bill exceeds budget",
                 f"Average logged usage projects PHP {output(projected, '0.01'):,.2f}, "
                 f"PHP {output(projected - budget, '0.01'):,.2f} above your budget.", max(recorded),
                 {"projected_bill": output(projected, "0.01"), "monthly_budget": float(budget),
                  "over_budget_by": output(projected - budget, "0.01"), "logged_days": len(recorded),
                  "projection_method": "average_logged_day_times_days_in_month"},
                 {"label": "Adjust plan", "href": "/budget"})
    for day, usage in sorted(recorded.items()):
        if usage > limit:
            emit(f"daily:{day}", "daily_limit_exceeded", "usage", "warning", "Daily limit exceeded",
                 f"You logged {output(usage)} kWh against a {output(limit)} kWh daily limit.", day,
                 {"kwh": output(usage), "daily_limit_kwh": output(limit), "over_by_kwh": output(usage - limit)},
                 {"label": "View usage", "href": "/"})
        prior = [value for d, value in sorted(history.items(), reverse=True) if day - DAY * 14 <= d < day][:7]
        if len(prior) >= 3:
            average = sum(prior, ZERO) / len(prior)
            if usage > average * Decimal("1.15"):
                emit(f"spike:{day}", "unusual_spike", "usage", "warning", "Usage above your average",
                     f"You logged {output(usage)} kWh versus a {output(average)} kWh average over {len(prior)} prior logged days.", day,
                     {"kwh": output(usage), "average_kwh": output(average), "baseline_days": len(prior),
                      "percent_above_average": percentage(usage - average, average)},
                     {"label": "View usage", "href": "/"})
    total = sum((daily_kwh(a) for a in appliances), ZERO)
    if total:
        biggest = max(appliances, key=lambda a: (daily_kwh(a), -a.id))
        share = percentage(daily_kwh(biggest), total)
        details = {"appliance_id": biggest.id, "estimated_share_percent": share,
                   "source": "manual_appliance_estimates"}
        message = f"This appliance accounts for {share}% of estimated active appliance consumption."
        if not biggest.is_must_have:
            hours = min(Decimal(1), biggest.hours_per_day)
            savings = biggest.watts * biggest.quantity * hours / 1000 * end.day * rate
            details.update(reduce_hours_per_day=float(hours), estimated_monthly_savings=output(savings, "0.01"))
            message += f" Reducing use by {hours} hour(s) daily would save an estimated PHP {output(savings, '0.01'):,.2f} per month."
        emit(f"appliance_cost:{month}:{biggest.id}", "wasteful_appliances", "appliances", "info",
             f"{biggest.name} has the highest estimated cost", message, as_of, details,
             {"label": "Edit hours", "href": "/appliances"})
    for appliance in appliances:
        if appliance.standby_watts and appliance.standby_hours_per_day:
            consumption = appliance.standby_watts * appliance.quantity * appliance.standby_hours_per_day / 1000
            cost = consumption * end.day * rate
            emit(f"standby:{month}:{appliance.id}", "wasteful_appliances", "appliances", "warning",
                 f"{appliance.name} has recorded standby consumption",
                 f"Entered standby power and hours imply PHP {output(cost, '0.01'):,.2f} per month. Review whether this standby use is necessary.",
                 as_of, {"appliance_id": appliance.id, "standby_watts": float(appliance.standby_watts),
                         "standby_hours_per_day": float(appliance.standby_hours_per_day),
                         "estimated_monthly_cost": output(cost, "0.01"), "source": "manual_standby_inputs"},
                 {"label": "Review appliance", "href": "/appliances"})
    solar = db.session.scalars(select(SolarGeneration).where(
        SolarGeneration.household_id == household.id,
        SolarGeneration.date >= first, SolarGeneration.date <= as_of)).all()
    for row in solar:
        expected = row.expected_generation_kwh
        if expected is not None and expected > 0 and row.generation_kwh < expected * Decimal("0.70"):
            emit(f"solar:{row.date}", "solar_underperforming", "solar", "warning",
                 "Solar output lower than expected",
                 f"Logged {row.generation_kwh} kWh versus {expected} kWh expected. Review the logs and operating conditions.",
                 row.date, {"generation_kwh": float(row.generation_kwh), "expected_generation_kwh": float(expected),
                            "percent_of_expected": percentage(row.generation_kwh, expected)},
                 {"label": "Log reading", "href": "/solar"})
    sunday = first + DAY * ((6 - first.weekday()) % 7)
    while sunday <= as_of:
        week = [v for d, v in history.items() if sunday - DAY * 6 <= d <= sunday]
        if week:
            usage = sum(week, ZERO)
            emit(f"weekly:{sunday}", "weekly_summary", "usage", "info", "Your weekly energy summary",
                 f"{output(usage)} kWh recorded over {len(week)} of 7 days this week.", sunday,
                 {"start_date": (sunday - DAY * 6).isoformat(), "end_date": sunday.isoformat(),
                  "logged_days": len(week), "kwh": output(usage), "estimated_cost": output(usage * rate, "0.01")},
                 {"label": "View usage", "href": "/"})
        sunday += DAY * 7
    return events


def refresh_alerts(household_id, month=None):
    household = db.one_or_404(select(Household).where(Household.id == household_id).with_for_update())
    first, _, _ = selected_month(month)
    month = first.strftime("%Y-%m")
    events = candidates(household, month, get_rules(household_id))
    existing = {row.event_key: row for row in db.session.scalars(select(Alert).where(
        Alert.household_id == household_id, Alert.month == month)).all()}
    now = datetime.now(timezone.utc)
    added = resolved = 0
    seen = set()
    for event in events:
        key = event["event_key"]
        seen.add(key)
        row = existing.get(key)
        if row is None:
            row = Alert(household_id=household_id, **event)
            db.session.add(row)
            added += 1
        else:
            if not row.is_active:
                row.read_at = None
                row.created_at = now
            for name, value in event.items():
                setattr(row, name, value)
        row.is_active = True
        row.resolved_at = None
    for key, row in existing.items():
        if key not in seen and row.is_active:
            row.is_active = False
            row.resolved_at = now
            resolved += 1
    db.session.flush()
    return {"month": month, "created": added, "resolved": resolved, "active": len(events)}


def refresh_after_log(household_id, log_date):
    months = {log_date.strftime("%Y-%m")}
    affected = min(log_date + DAY * 14, today())
    months.add(affected.strftime("%Y-%m"))
    for month in sorted(months):
        refresh_alerts(household_id, month)


def serialize(row):
    return {"id": row.id, "category": row.category, "rule": row.rule,
            "severity": row.severity, "title": row.title, "message": row.message,
            "details": row.details, "action": row.action, "month": row.month,
            "occurred_on": row.occurred_on.isoformat(), "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(), "is_active": row.is_active,
            "is_read": row.read_at is not None,
            "read_at": row.read_at.isoformat() if row.read_at else None,
            "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None}
