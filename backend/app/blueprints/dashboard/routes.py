from datetime import date, timedelta
from decimal import Decimal, InvalidOperation

from flask import jsonify, request
from sqlalchemy import select

from . import dashboard_bp
from .calculations import daily_usage, month_before, overview, selected_month, today
from ..planning.services import fingerprint
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Appliance, BudgetPlan, Household, MeterReading, SolarGeneration


def household_record(household_id, *, lock=False):
    query = select(Household).where(Household.id == household_id)
    return db.one_or_404(query.with_for_update() if lock else query)


def dashboard_data(household_id):
    household = household_record(household_id)
    first, end, as_of = selected_month(request.args.get("month"))
    period = request.args.get("period", "day")
    if period not in {"day", "week", "month"}:
        raise ValidationError("period must be day, week, or month.")
    appliances = db.session.scalars(select(Appliance).where(
        Appliance.household_id == household_id).order_by(Appliance.id)).all()
    readings = db.session.scalars(select(MeterReading).where(
        MeterReading.household_id == household_id,
        MeterReading.date >= month_before(first, 11) - timedelta(days=1),
        MeterReading.date <= as_of).order_by(MeterReading.date)).all()
    solar = db.session.scalar(select(SolarGeneration).where(
        SolarGeneration.household_id == household_id, SolarGeneration.date == as_of))
    saved = db.session.scalar(select(BudgetPlan).where(
        BudgetPlan.household_id == household_id, BudgetPlan.month == first.strftime("%Y-%m")))
    settings = {"rate": household.electricity_rate, "budget": household.monthly_budget,
                "source": "household", "is_stale": False}
    if saved:
        settings.update(rate=Decimal(str(saved.snapshot["electricity_rate"])),
                        budget=Decimal(str(saved.snapshot["monthly_budget"])),
                        source="saved_budget_plan",
                        is_stale=saved.source_fingerprint != fingerprint(household, appliances))
    return overview(household, appliances, readings, solar, first, end, as_of, period, settings)


@dashboard_bp.get("")
def get_dashboard(household_id):
    result, _ = dashboard_data(household_id)
    return jsonify(result)


@dashboard_bp.get("/alerts")
def get_alerts(household_id):
    result, alerts = dashboard_data(household_id)
    return jsonify(month=result["month"], items=alerts, count=len(alerts))


def parse_date(value):
    try:
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value or parsed < date(2000, 1, 1) or parsed > today():
            raise ValueError
    except (TypeError, ValueError):
        raise ValidationError("date must be YYYY-MM-DD between 2000-01-01 and today in Manila.") from None
    return parsed


def kwh(value, field):
    try:
        number = Decimal(str(value))
        if not number.is_finite() or not 0 <= number <= Decimal("999999999999.999"):
            raise ValueError
        if number != number.quantize(Decimal("0.001")):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError(f"{field} must be nonnegative kWh with up to 3 decimal places.") from None
    return number


def log_record(model, household_id, log_date):
    return db.session.scalar(select(model).where(
        model.household_id == household_id, model.date == log_date))


def meter_values(household_id, start, stop):
    rows = db.session.scalars(select(MeterReading).where(
        MeterReading.household_id == household_id,
        MeterReading.date >= start - timedelta(days=1), MeterReading.date <= stop)
        .order_by(MeterReading.date)).all()
    return rows, daily_usage(rows)


def serialize_log(row, usage=None):
    result = {"id": row.id, "household_id": row.household_id, "date": row.date.isoformat(),
              "updated_at": row.updated_at.isoformat()}
    if isinstance(row, MeterReading):
        result.update(
            consumption_kwh=float(row.consumption_kwh) if row.consumption_kwh is not None else None,
            meter_reading_kwh=float(row.meter_reading_kwh) if row.meter_reading_kwh is not None else None,
            daily_usage_kwh=float(usage[row.date]) if usage is not None and row.date in usage else None)
    else:
        result.update(generation_kwh=float(row.generation_kwh),
                      self_consumed_kwh=float(row.self_consumed_kwh) if row.self_consumed_kwh is not None else None)
    return result


def validate_counter(household_id, log_date, value):
    # Meter replacement/rollover requires a separate future workflow.
    base = select(MeterReading).where(MeterReading.household_id == household_id,
                                      MeterReading.meter_reading_kwh.is_not(None))
    previous = db.session.scalar(base.where(MeterReading.date < log_date)
                                 .order_by(MeterReading.date.desc()).limit(1))
    following = db.session.scalar(base.where(MeterReading.date > log_date)
                                  .order_by(MeterReading.date).limit(1))
    if ((previous and value < previous.meter_reading_kwh)
            or (following and value > following.meter_reading_kwh)):
        raise ValidationError("Cumulative readings must not decrease across dates. Check adjacent readings.")


def save_log(model, household_id, log_date, data):
    household_record(household_id, lock=True)
    log_date = parse_date(log_date)
    if model is MeterReading:
        if len(data) != 1 or not set(data) <= {"consumption_kwh", "meter_reading_kwh"}:
            raise ValidationError("Provide exactly one of consumption_kwh or meter_reading_kwh.")
        field = next(iter(data))
        value = kwh(data[field], field)
        if field == "meter_reading_kwh":
            validate_counter(household_id, log_date, value)
        values = {"consumption_kwh": None, "meter_reading_kwh": None, field: value}
    else:
        if "generation_kwh" not in data or set(data) - {"generation_kwh", "self_consumed_kwh"}:
            raise ValidationError("Provide generation_kwh and optional self_consumed_kwh.")
        generation = kwh(data["generation_kwh"], "generation_kwh")
        used = kwh(data["self_consumed_kwh"], "self_consumed_kwh") if data.get("self_consumed_kwh") is not None else None
        if used is not None and used > generation:
            raise ValidationError("self_consumed_kwh cannot exceed generation_kwh.")
        values = {"generation_kwh": generation, "self_consumed_kwh": used}
    row = log_record(model, household_id, log_date)
    created = row is None
    if created:
        row = model(household_id=household_id, date=log_date)
        db.session.add(row)
    for key, value in values.items():
        setattr(row, key, value)
    db.session.commit()
    usage = meter_values(household_id, log_date, log_date)[1] if model is MeterReading else None
    return jsonify(item=serialize_log(row, usage)), 201 if created else 200


@dashboard_bp.get("/meter-readings")
def list_meter_readings(household_id):
    household_record(household_id)
    first, _, as_of = selected_month(request.args.get("month"))
    readings, usage = meter_values(household_id, first, as_of)
    return jsonify(items=[serialize_log(row, usage) for row in readings if row.date >= first])


@dashboard_bp.post("/meter-readings")
def create_meter_reading(household_id):
    data = json_payload()
    return save_log(MeterReading, household_id, data.pop("date", None), data)


@dashboard_bp.put("/meter-readings/<log_date>")
def replace_meter_reading(household_id, log_date):
    return save_log(MeterReading, household_id, log_date, json_payload())


@dashboard_bp.put("/solar-generation/<log_date>")
def replace_solar_generation(household_id, log_date):
    return save_log(SolarGeneration, household_id, log_date, json_payload())


@dashboard_bp.get("/solar-generation")
def list_solar_generation(household_id):
    household_record(household_id)
    first, _, as_of = selected_month(request.args.get("month"))
    rows = db.session.scalars(select(SolarGeneration).where(
        SolarGeneration.household_id == household_id,
        SolarGeneration.date >= first, SolarGeneration.date <= as_of).order_by(SolarGeneration.date)).all()
    return jsonify(items=[serialize_log(row) for row in rows])


def remove_log(model, household_id, log_date):
    household_record(household_id, lock=True)
    row = db.one_or_404(select(model).where(model.household_id == household_id,
                                         model.date == parse_date(log_date)))
    db.session.delete(row)
    db.session.commit()
    return "", 204


@dashboard_bp.delete("/meter-readings/<log_date>")
def delete_meter_reading(household_id, log_date):
    return remove_log(MeterReading, household_id, log_date)


@dashboard_bp.delete("/solar-generation/<log_date>")
def delete_solar_generation(household_id, log_date):
    return remove_log(SolarGeneration, household_id, log_date)
