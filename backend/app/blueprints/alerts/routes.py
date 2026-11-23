from datetime import datetime, timezone

from flask import jsonify, request
from sqlalchemy import select, update

from . import alerts_bp
from .engine import (CATEGORIES, DEFAULTS, get_rules, refresh_alerts, serialize, settings)
from ..dashboard.calculations import selected_month
from ...calculations import output
from ...errors import ValidationError, json_payload
from ...extensions import db
from ...models import Alert, AlertRules, Household


def household(household_id, lock=False):
    query = select(Household).where(Household.id == household_id)
    return db.one_or_404(query.with_for_update() if lock else query)


def month_value(value=None):
    return selected_month(value)[0].strftime("%Y-%m")


def rule_response(household_id):
    row = household(household_id)
    first, end, _ = selected_month(request.args.get("month"))
    budget, rate = settings(row, first.strftime("%Y-%m"))
    return {"rules": get_rules(household_id), "month": first.strftime("%Y-%m"),
            "thresholds": {"daily_limit_kwh": output(budget / rate / end.day),
                           "monthly_budget": float(budget), "unusual_spike_percent": 15,
                           "solar_minimum_percent_of_expected": 70},
            "evaluation": "on_reading_write_or_explicit_refresh",
            "weekly_summary": "Sunday recaps are created during evaluation, not by a background scheduler."}


@alerts_bp.get("")
def list_alerts(household_id):
    household(household_id)
    month = month_value(request.args.get("month"))
    category = request.args.get("category", "all")
    status = request.args.get("status", "active")
    read = request.args.get("read", "all")
    if category not in ("all", *CATEGORIES) or status not in {"active", "resolved", "all"} or read not in {"all", "read", "unread"}:
        raise ValidationError("Invalid category, status, or read filter.")
    try:
        limit = int(request.args.get("limit", 50))
        offset = int(request.args.get("offset", 0))
        if not 1 <= limit <= 100 or offset < 0:
            raise ValueError
    except ValueError:
        raise ValidationError("limit must be 1-100 and offset must be nonnegative.") from None
    query = select(Alert).where(Alert.household_id == household_id, Alert.month == month)
    if status != "all":
        query = query.where(Alert.is_active.is_(status == "active"))
    rows = db.session.scalars(query.order_by(Alert.created_at.desc(), Alert.id.desc())).all()
    counts = {"all": len(rows), **{name: sum(a.category == name for a in rows) for name in CATEGORIES}}
    unread = sum(a.read_at is None for a in rows)
    filtered = [a for a in rows if (category == "all" or a.category == category)
                and (read == "all" or (a.read_at is None) == (read == "unread"))]
    return jsonify(month=month, items=[serialize(a) for a in filtered[offset:offset + limit]],
                   counts=counts, unread_count=unread, total=len(filtered), limit=limit, offset=offset)


@alerts_bp.get("/rules")
def list_rules(household_id):
    return jsonify(rule_response(household_id))


@alerts_bp.patch("/rules")
def change_rules(household_id):
    household(household_id, lock=True)
    data = json_payload()
    if not data or set(data) - DEFAULTS.keys() or any(type(value) is not bool for value in data.values()):
        raise ValidationError("Provide one or more rule names with true/false values.")
    row = db.session.get(AlertRules, household_id)
    if row is None:
        row = AlertRules(household_id=household_id, **DEFAULTS)
        db.session.add(row)
    for key, value in data.items():
        setattr(row, key, value)
    db.session.flush()
    disabled = [name for name, enabled in get_rules(household_id).items() if not enabled]
    if disabled:
        db.session.execute(update(Alert).where(
            Alert.household_id == household_id, Alert.rule.in_(disabled), Alert.is_active.is_(True))
            .values(is_active=False, resolved_at=datetime.now(timezone.utc)))
    refresh_alerts(household_id, month_value(request.args.get("month")))
    db.session.commit()
    return jsonify(rule_response(household_id))


@alerts_bp.post("/refresh")
def refresh(household_id):
    data = json_payload()
    if set(data) - {"month"}:
        raise ValidationError("Only month is accepted.")
    result = refresh_alerts(household_id, month_value(data.get("month")))
    db.session.commit()
    return jsonify(result)


@alerts_bp.post("/mark-all-read")
def mark_all_read(household_id):
    household(household_id, lock=True)
    data = json_payload()
    if set(data) - {"month"}:
        raise ValidationError("Only month is accepted.")
    month = month_value(data.get("month"))
    result = db.session.execute(update(Alert).where(
        Alert.household_id == household_id, Alert.month == month, Alert.read_at.is_(None))
        .values(read_at=datetime.now(timezone.utc)))
    db.session.commit()
    return jsonify(month=month, updated_count=result.rowcount)


@alerts_bp.patch("/<int:alert_id>")
def mark_read(household_id, alert_id):
    household(household_id, lock=True)
    data = json_payload()
    if set(data) != {"is_read"} or type(data["is_read"]) is not bool:
        raise ValidationError("Provide is_read as true or false.")
    row = db.one_or_404(select(Alert).where(Alert.id == alert_id, Alert.household_id == household_id))
    if not data["is_read"]:
        row.read_at = None
    elif row.read_at is None:
        row.read_at = datetime.now(timezone.utc)
    db.session.commit()
    return jsonify(item=serialize(row))
