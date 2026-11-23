from flask import jsonify, request

from . import appliances_bp
from .estimates import estimate_period, serialize
from .validation import validate_appliance
from .services import get_appliance, list_summary, remove_appliance, save_appliance
from ...errors import json_payload
from ...extensions import db
from ...models import Household


@appliances_bp.get("")
def list_appliances(household_id):
    household = db.get_or_404(Household, household_id)
    month, days = estimate_period(request.args.get("month"))
    return jsonify(list_summary(household, month, days, request.args.get("category", "all")))


@appliances_bp.post("")
def create_appliance(household_id):
    household = db.get_or_404(Household, household_id)
    values = validate_appliance(json_payload())
    month, days = estimate_period(request.args.get("month"))
    appliance = save_appliance(household_id, values)
    return jsonify(item=serialize(appliance, days, household.electricity_rate), month=month), 201


@appliances_bp.get("/<int:appliance_id>")
def retrieve_appliance(household_id, appliance_id):
    appliance = get_appliance(household_id, appliance_id)
    month, days = estimate_period(request.args.get("month"))
    return jsonify(item=serialize(appliance, days, appliance.household.electricity_rate), month=month)


@appliances_bp.patch("/<int:appliance_id>")
def update_appliance(household_id, appliance_id):
    appliance = get_appliance(household_id, appliance_id)
    values = validate_appliance(json_payload(), partial=True)
    month, days = estimate_period(request.args.get("month"))
    appliance = save_appliance(household_id, values, appliance)
    return jsonify(item=serialize(appliance, days, appliance.household.electricity_rate), month=month)


@appliances_bp.delete("/<int:appliance_id>")
def delete_appliance(household_id, appliance_id):
    appliance = get_appliance(household_id, appliance_id)
    remove_appliance(appliance)
    return "", 204
