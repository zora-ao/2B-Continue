import hashlib
import json

from sqlalchemy import select

from .calculations import build_plan
from .validation import STYLES, validate_request
from ..appliances.estimates import estimate_period
from ..appliances.services import apply_appliance_values
from ...errors import ValidationError
from ...extensions import db
from ...models import Appliance, BudgetPlan, Household


def get_household(household_id, *, lock=False):
    query = select(Household).where(Household.id == household_id)
    if lock:
        query = query.with_for_update()
    return db.one_or_404(query)


def get_appliances(household_id, *, lock=False):
    query = select(Appliance).where(Appliance.household_id == household_id).order_by(Appliance.id)
    if lock:
        query = query.with_for_update()
    return db.session.scalars(query).all()


def fingerprint(household, appliances):
    source = {
        "rate": str(household.electricity_rate), "budget": str(household.monthly_budget),
        "appliances": [{"id": a.id, "name": a.name, "type": a.appliance_type,
                        "watts": str(a.watts), "quantity": a.quantity,
                        "hours": str(a.hours_per_day), "must_have": a.is_must_have}
                       for a in appliances],
    }
    return hashlib.sha256(json.dumps(source, sort_keys=True).encode()).hexdigest()


def find_saved(household_id, month):
    return db.session.scalar(select(BudgetPlan).where(
        BudgetPlan.household_id == household_id, BudgetPlan.month == month))


def serialize_saved(saved, household, appliances):
    return {"id": saved.id, "household_id": saved.household_id,
            "created_at": saved.created_at.isoformat(),
            "updated_at": saved.updated_at.isoformat(),
            "is_stale": saved.source_fingerprint != fingerprint(household, appliances),
            "plan": saved.snapshot}


def planner_state(household_id, month):
    household = get_household(household_id)
    month, days = estimate_period(month)
    appliances = get_appliances(household_id)
    settings = validate_request({"month": month}, household)
    saved = find_saved(household_id, month)
    return {
        "household_id": household_id,
        "defaults": {"month": month, "days_in_month": days, "style": "balanced",
                     "monthly_budget": float(household.monthly_budget),
                     "electricity_rate": float(household.electricity_rate)},
        "styles": list(STYLES),
        "preview": build_plan(appliances, **settings),
        "saved_plan": serialize_saved(saved, household, appliances) if saved else None,
    }


def generate_plan(household_id, data):
    household = get_household(household_id)
    settings = validate_request(data, household)
    return build_plan(get_appliances(household_id), **settings)


def update_plan_hours(household_id, appliance_id, data):
    household = get_household(household_id, lock=True)
    settings = validate_request(data, household)
    adjustments = settings["adjustments"]
    if appliance_id not in adjustments:
        raise ValidationError("Provide the hours for the selected appliance.")
    appliances = get_appliances(household_id, lock=True)
    appliance = next((item for item in appliances if item.id == appliance_id), None)
    if appliance is None:
        raise ValidationError("The selected appliance does not belong to this household.")

    with db.session.begin_nested():
        apply_appliance_values(household_id, {"hours_per_day": adjustments[appliance_id]}, appliance)
        plan = build_plan(appliances, **settings)
        state = planner_state(household_id, settings["month"])
    db.session.commit()
    return {"plan": plan, "preview": state["preview"], "saved_plan": state["saved_plan"]}


def save_plan(household_id, data):
    # Serialize concurrent saves to the household/month's single plan row.
    household = get_household(household_id, lock=True)
    settings = validate_request(data, household)
    appliances = get_appliances(household_id)
    plan = build_plan(appliances, **settings)
    saved = find_saved(household_id, settings["month"])
    if saved is None:
        saved = BudgetPlan(household_id=household_id, month=settings["month"])
        db.session.add(saved)
    saved.snapshot = plan
    saved.source_fingerprint = fingerprint(household, appliances)
    db.session.commit()
    return serialize_saved(saved, household, appliances)


def reset_plan(household_id, month):
    get_household(household_id, lock=True)
    month, _ = estimate_period(month)
    saved = find_saved(household_id, month)
    if saved is not None:
        db.session.delete(saved)
    db.session.commit()
