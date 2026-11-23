from datetime import date, timedelta
from decimal import ROUND_CEILING, ROUND_HALF_UP, Decimal, InvalidOperation

from flask import jsonify, request
from sqlalchemy import select

from . import solar_bp
from .calculations import month_savings, monthly_usage, recommendations, week_performance
from .catalog import DEFAULT_PANEL_WATTS, DEFAULT_PLACE, FALLBACK_SUN_HOURS, PERFORMANCE_RATIO
from .places import PlaceSearchError, search_places, yearly_sun_hours
from .weather import daily_weather
from ..dashboard.calculations import today
from ..dashboard.routes import household_record, meter_values, remove_log, save_log
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Appliance, SolarGeneration, SolarProfile

PROFILE_FIELDS = {"location", "install_budget", "system_kw", "panel_watts"}
# The Philippines' bounding box: a saved place must be inside it.
LATITUDE_RANGE = (Decimal(4), Decimal(22))
LONGITUDE_RANGE = (Decimal(116), Decimal(127))
TWO_PLACES = Decimal("0.01")


# ---------- input parsing ----------

def parse_coordinate(value, field, bounds):
    try:
        if isinstance(value, bool) or not isinstance(value, (int, float, str)):
            raise ValueError
        number = Decimal(str(value))
        if not number.is_finite() or not bounds[0] <= number <= bounds[1]:
            raise ValueError
    except (InvalidOperation, ValueError):
        raise ValidationError(f"location.{field} must be a number from {bounds[0]} to {bounds[1]} "
                              "(a place in the Philippines).") from None
    # Rounded to about 1 km: enough for sunlight, without storing where a home is.
    return number.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def parse_place(value):
    if not isinstance(value, dict):
        raise ValidationError("location must be an object with name, latitude and longitude.")
    name = value.get("name")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        raise ValidationError("location.name must be 1 to 120 characters.")
    return {"name": name.strip(),
            "latitude": parse_coordinate(value.get("latitude"), "latitude", LATITUDE_RANGE),
            "longitude": parse_coordinate(value.get("longitude"), "longitude", LONGITUDE_RANGE)}


def parse_place_query(value):
    query = (value or "").strip()
    if not 2 <= len(query) <= 100:
        raise ValidationError("q must be 2 to 100 characters.")
    return query


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


def profile_settings(profile):
    if profile is None:
        return {**DEFAULT_PLACE, "sun_hours_estimated": True, "is_default": True,
                "install_budget": None, "system_kw": None, "panel_watts": DEFAULT_PANEL_WATTS,
                "is_saved": False, "updated_at": None}
    return {"name": profile.location_name, "latitude": profile.latitude,
            "longitude": profile.longitude, "sun_hours": profile.sun_hours,
            "sun_hours_estimated": profile.sun_hours_estimated, "is_default": False,
            "install_budget": profile.install_budget, "system_kw": profile.system_kw,
            "panel_watts": profile.panel_watts, "is_saved": True,
            "updated_at": profile.updated_at.isoformat()}


def serialize_location(settings):
    return {"name": settings["name"], "latitude": float(settings["latitude"]),
            "longitude": float(settings["longitude"]), "sun_hours": float(settings["sun_hours"]),
            "sun_hours_estimated": settings["sun_hours_estimated"],
            "is_default": settings["is_default"]}


def serialize_profile(settings):
    kw = settings["system_kw"]
    return {"location": serialize_location(settings),
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
    rate = household.electricity_rate
    return {
        "location": serialize_location(settings),
        "install_budget": float(settings["install_budget"]) if settings["install_budget"] is not None else None,
        "electricity_rate": float(rate),
        "usage": {"monthly_kwh": round(float(usage), 1) if usage is not None else None,
                  "source": source, "logged_days_last_30": logged},
        "systems": recommendations(settings["sun_hours"], usage, rate,
                                   settings["install_budget"]),
    }


def performance_section(household, settings, monday):
    kw = settings["system_kw"]
    if kw is None:
        return None
    as_of = today()
    latitude, longitude = settings["latitude"], settings["longitude"]
    sunday = monday + timedelta(days=6)
    month_start = as_of.replace(day=1)
    sun_hours = settings["sun_hours"]
    weather = daily_weather(latitude, longitude, monday, sunday, as_of)
    current_monday = as_of - timedelta(days=as_of.weekday())
    if monday == current_monday:
        current_weather = weather
    else:
        current_weather = daily_weather(latitude, longitude, as_of, as_of, as_of)
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
    """Query-string what-if for the budget input, without saving."""
    settings = dict(settings)
    if "install_budget" in request.args:
        raw = request.args["install_budget"]
        settings["install_budget"] = parse_budget(raw) if raw != "" else None
    return settings


# ---------- endpoints ----------

@solar_bp.get("")
def get_solar(household_id):
    household = household_record(household_id)
    settings = overrides(profile_settings(get_profile(household_id)))
    monday = parse_week(request.args.get("week_of"))
    return jsonify(household_id=household_id, profile=serialize_profile(settings),
                   recommendations=recommendation_section(household, settings),
                   my_system=performance_section(household, settings, monday))


@solar_bp.get("/places")
def find_places(household_id):
    household_record(household_id)
    query = parse_place_query(request.args.get("q"))
    try:
        return jsonify(items=search_places(query))
    except PlaceSearchError:
        return jsonify(error="Place search is unavailable. Try again."), 502


@solar_bp.get("/recommendations")
def get_recommendations(household_id):
    household = household_record(household_id)
    settings = overrides(profile_settings(get_profile(household_id)))
    return jsonify(recommendation_section(household, settings))


@solar_bp.get("/performance")
def get_performance(household_id):
    household = household_record(household_id)
    settings = profile_settings(get_profile(household_id))
    if settings["system_kw"] is None:
        raise ValidationError("Set system_kw on the solar profile to track panel performance.")
    return jsonify(performance_section(household, settings, parse_week(request.args.get("week_of"))))


@solar_bp.get("/profile")
def get_solar_profile(household_id):
    household_record(household_id)
    return jsonify(item=serialize_profile(profile_settings(get_profile(household_id))))


@solar_bp.put("/profile")
def save_solar_profile(household_id):
    household_record(household_id)
    data = json_payload()
    if set(data) - PROFILE_FIELDS:
        raise ValidationError(f"Only {', '.join(sorted(PROFILE_FIELDS))} are accepted.")
    # Validate everything first, so a bad field never waits on Open-Meteo.
    place = parse_place(data["location"]) if "location" in data else None
    changes = {}
    if "install_budget" in data:
        changes["install_budget"] = parse_budget(data["install_budget"])
    if "system_kw" in data:
        changes["system_kw"] = parse_system_kw(data["system_kw"])
    if "panel_watts" in data:
        changes["panel_watts"] = parse_panel_watts(data["panel_watts"])

    if place is not None:
        # Fetch sunlight with no transaction open: a slow Open-Meteo must not hold a lock or a connection.
        db.session.commit()
        sun_hours = yearly_sun_hours(place["latitude"], place["longitude"], today())
        changes.update(location_name=place["name"], latitude=place["latitude"],
                       longitude=place["longitude"],
                       sun_hours=sun_hours if sun_hours is not None else FALLBACK_SUN_HOURS,
                       sun_hours_estimated=sun_hours is None)

    household_record(household_id, lock=True)
    profile = get_profile(household_id)
    created = profile is None
    if created:
        profile = SolarProfile(household_id=household_id, location_name=DEFAULT_PLACE["name"],
                               latitude=DEFAULT_PLACE["latitude"],
                               longitude=DEFAULT_PLACE["longitude"],
                               sun_hours=DEFAULT_PLACE["sun_hours"], sun_hours_estimated=True,
                               panel_watts=DEFAULT_PANEL_WATTS)
        db.session.add(profile)
    for field, value in changes.items():
        setattr(profile, field, value)
    db.session.commit()
    return jsonify(item=serialize_profile(profile_settings(profile))), 201 if created else 200


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
