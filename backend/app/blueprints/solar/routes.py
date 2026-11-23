from datetime import date, timedelta
from decimal import ROUND_CEILING, Decimal, InvalidOperation

from flask import jsonify, request
from sqlalchemy import select

from . import solar_bp
from .calculations import month_savings, monthly_usage, recommendations, week_performance
from .catalog import (DEFAULT_LOCATION, DEFAULT_PANEL_WATTS, LOCATIONS, PERFORMANCE_RATIO,
                      serialize_location)
from .weather import daily_weather
from ..dashboard.calculations import today
from ..dashboard.routes import household_record, meter_values, remove_log, save_log
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Appliance, SolarGeneration, SolarProfile

PROFILE_FIELDS = {"location_key", "install_budget", "system_kw", "panel_watts"}


# ---------- input parsing ----------

def parse_location(value):
    if value not in LOCATIONS:
        raise ValidationError(f"location must be one of: {', '.join(LOCATIONS)}.")
    return value


def parse_budget(value):
    if value is None:
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite() or not 0 <= number <= Decimal("9999999999.99"):
            raise ValueError
        if number != number.quantize(Decimal("0.01")):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError("install_budget must be a nonnegative amount with up to 2 decimal places.") from None
    return number


def parse_system_kw(value):
    if value is None:
        return None
    try:
        number = Decimal(str(value))
        if not number.is_finite() or not 0 < number <= Decimal("999.999"):
            raise ValueError
        if number != number.quantize(Decimal("0.001")):
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError("system_kw must be greater than 0 and at most 999.999 kW.") from None
    return number


def parse_panel_watts(value):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= 2000:
        raise ValidationError("panel_watts must be a whole number between 1 and 2000.")
    return value


def parse_week(value):
    if value is None:
        day = today()
    else:
        try:
            day = date.fromisoformat(value)
            if day.isoformat() != value or day < date(2000, 1, 1) or day > today():
                raise ValueError
        except (TypeError, ValueError):
            raise ValidationError("week_of must be YYYY-MM-DD between 2000-01-01 and today in Manila.") from None
    return day - timedelta(days=day.weekday())


# ---------- data access ----------

def get_profile(household_id):
    return db.session.scalar(select(SolarProfile).where(SolarProfile.household_id == household_id))


def guess_location(household):
    text = (household.location or "").lower()
    for key, location in LOCATIONS.items():
        if location["name"].lower() in text:
            return key
    return DEFAULT_LOCATION


def profile_settings(household, profile):
    if profile is None:
        return {"location_key": guess_location(household), "install_budget": None,
                "system_kw": None, "panel_watts": DEFAULT_PANEL_WATTS, "is_saved": False,
                "updated_at": None}
    return {"location_key": profile.location_key, "install_budget": profile.install_budget,
            "system_kw": profile.system_kw, "panel_watts": profile.panel_watts, "is_saved": True,
            "updated_at": profile.updated_at.isoformat()}


def serialize_profile(settings):
    kw = settings["system_kw"]
    return {"location": serialize_location(settings["location_key"]),
            "install_budget": float(settings["install_budget"]) if settings["install_budget"] is not None else None,
            "system_kw": float(kw) if kw is not None else None,
            "panel_watts": settings["panel_watts"],
            "panel_count": int((kw * 1000 / settings["panel_watts"]).to_integral_value(rounding=ROUND_CEILING)) if kw is not None else None,
            "performance_ratio": float(PERFORMANCE_RATIO),
            "is_saved": settings["is_saved"], "updated_at": settings["updated_at"]}


def solar_logs(household_id, start, stop):
    rows = db.session.scalars(select(SolarGeneration).where(
        SolarGeneration.household_id == household_id,
        SolarGeneration.date >= start, SolarGeneration.date <= stop)).all()
    return {row.date: row for row in rows}


# ---------- page sections ----------

def recommendation_section(household, settings):
    as_of = today()
    _, usage_by_day = meter_values(household.id, as_of - timedelta(days=29), as_of)
    recent = {d: v for d, v in usage_by_day.items() if d >= as_of - timedelta(days=29)}
    appliances = db.session.scalars(select(Appliance).where(
        Appliance.household_id == household.id)).all()
    usage, source, logged = monthly_usage(recent, appliances)
    location = LOCATIONS[settings["location_key"]]
    rate = household.electricity_rate
    return {
        "location": serialize_location(settings["location_key"]),
        "install_budget": float(settings["install_budget"]) if settings["install_budget"] is not None else None,
        "electricity_rate": float(rate),
        "usage": {"monthly_kwh": round(float(usage), 1) if usage is not None else None,
                  "source": source, "logged_days_last_30": logged},
        "systems": recommendations(Decimal(location["sun_hours"]), usage, rate,
                                   settings["install_budget"]),
    }


def performance_section(household, settings, monday):
    kw = settings["system_kw"]
    if kw is None:
        return None
    as_of = today()
    location = LOCATIONS[settings["location_key"]]
    sunday = monday + timedelta(days=6)
    month_start = as_of.replace(day=1)
    sun_hours = Decimal(location["sun_hours"])
    weather = daily_weather(location["latitude"], location["longitude"], monday, sunday, as_of)
    current_monday = as_of - timedelta(days=as_of.weekday())
    if monday == current_monday:
        current_weather = weather
    else:
        current_weather = daily_weather(location["latitude"], location["longitude"],
                                        as_of, as_of, as_of)
    logs = solar_logs(household.id, monday, sunday)
    days, alerts = week_performance(kw, sun_hours, weather, logs, monday, as_of)

    month_logs = solar_logs(household.id, min(month_start, current_monday), as_of)
    current_days, _ = week_performance(kw, sun_hours, current_weather, month_logs,
                                       current_monday, as_of)
    today_row = next(d for d in current_days if d["date"] == as_of.isoformat())

    _, grid = meter_values(household.id, month_start, as_of)
    month_logs = {d: row for d, row in month_logs.items() if d >= month_start}
    saved = month_savings(month_logs, {d: v for d, v in grid.items() if d >= month_start},
                          household.electricity_rate)
    saved["month"] = month_start.strftime("%Y-%m")

    return {
        "system_kw": float(kw),
        "weather_source": "open_meteo" if weather is not None else "location_average",
        "week": {"start_date": monday.isoformat(), "end_date": sunday.isoformat(), "days": days},
        "today": {"date": as_of.isoformat(), "generated_kwh": today_row["actual_kwh"],
                  "expected_kwh": today_row["expected_kwh"],
                  "percent_of_expected": today_row["percent_of_expected"],
                  "expected_source": today_row["expected_source"]},
        "saved_this_month": saved,
        "alerts": alerts, "alert_count": len(alerts),
    }


def overrides(settings):
    """Query-string what-ifs for the location/budget inputs, without saving."""
    settings = dict(settings)
    if "location" in request.args:
        settings["location_key"] = parse_location(request.args["location"])
    if "install_budget" in request.args:
        raw = request.args["install_budget"]
        settings["install_budget"] = parse_budget(raw) if raw != "" else None
    return settings


# ---------- endpoints ----------

@solar_bp.get("")
def get_solar(household_id):
    household = household_record(household_id)
    settings = overrides(profile_settings(household, get_profile(household_id)))
    monday = parse_week(request.args.get("week_of"))
    return jsonify(household_id=household_id, profile=serialize_profile(settings),
                   locations=[serialize_location(key) for key in LOCATIONS],
                   recommendations=recommendation_section(household, settings),
                   my_system=performance_section(household, settings, monday))


@solar_bp.get("/locations")
def list_locations(household_id):
    household_record(household_id)
    return jsonify(items=[serialize_location(key) for key in LOCATIONS])


@solar_bp.get("/recommendations")
def get_recommendations(household_id):
    household = household_record(household_id)
    settings = overrides(profile_settings(household, get_profile(household_id)))
    return jsonify(recommendation_section(household, settings))


@solar_bp.get("/performance")
def get_performance(household_id):
    household = household_record(household_id)
    settings = profile_settings(household, get_profile(household_id))
    if settings["system_kw"] is None:
        raise ValidationError("Set system_kw on the solar profile to track panel performance.")
    return jsonify(performance_section(household, settings, parse_week(request.args.get("week_of"))))


@solar_bp.get("/profile")
def get_solar_profile(household_id):
    household = household_record(household_id)
    return jsonify(item=serialize_profile(profile_settings(household, get_profile(household_id))))


@solar_bp.put("/profile")
def save_solar_profile(household_id):
    household = household_record(household_id, lock=True)
    data = json_payload()
    if set(data) - PROFILE_FIELDS:
        raise ValidationError(f"Only {', '.join(sorted(PROFILE_FIELDS))} are accepted.")
    profile = get_profile(household_id)
    created = profile is None
    if created:
        defaults = profile_settings(household, None)
        profile = SolarProfile(household_id=household_id, location_key=defaults["location_key"],
                               panel_watts=defaults["panel_watts"])
        db.session.add(profile)
    if "location_key" in data:
        profile.location_key = parse_location(data["location_key"])
    if "install_budget" in data:
        profile.install_budget = parse_budget(data["install_budget"])
    if "system_kw" in data:
        profile.system_kw = parse_system_kw(data["system_kw"])
    if "panel_watts" in data:
        profile.panel_watts = parse_panel_watts(data["panel_watts"])
    db.session.commit()
    return jsonify(item=serialize_profile(profile_settings(household, profile))), 201 if created else 200


@solar_bp.post("/readings")
def add_reading(household_id):
    """The page's "Add reading" button: log or replace a day's generation."""
    data = json_payload()
    return save_log(SolarGeneration, household_id, data.pop("date", None), data)


@solar_bp.put("/readings/<log_date>")
def replace_reading(household_id, log_date):
    return save_log(SolarGeneration, household_id, log_date, json_payload())


@solar_bp.delete("/readings/<log_date>")
def delete_reading(household_id, log_date):
    return remove_log(SolarGeneration, household_id, log_date)
