from flask import jsonify, request

from . import planning_bp
from .services import generate_plan, planner_state, reset_plan, save_plan, update_plan_hours
from ...errors import json_payload


@planning_bp.get("")
def get_planner(household_id):
    return jsonify(planner_state(household_id, request.args.get("month")))


@planning_bp.post("/generate")
def generate(household_id):
    return jsonify(plan=generate_plan(household_id, json_payload()))


@planning_bp.put("/plan")
def save(household_id):
    return jsonify(saved_plan=save_plan(household_id, json_payload()))


@planning_bp.patch("/hours/<int:appliance_id>")
def update_hours(household_id, appliance_id):
    return jsonify(update_plan_hours(household_id, appliance_id, json_payload()))


@planning_bp.delete("/plan")
def reset(household_id):
    reset_plan(household_id, request.args.get("month"))
    return "", 204
