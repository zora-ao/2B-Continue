from app.extensions import db
from app.models import Appliance, BudgetPlan, HouseholdInvite, HouseholdMember

from .conftest import csrf_headers, make_household, register


def test_owner_deletes_household_and_shared_data(client, app):
    assert register(client).status_code == 201
    member = client.application.test_client()
    assert register(member, email="housemate@example.com").status_code == 201
    home = make_household(client)
    path = f"/api/households/{home}"
    owner_headers = csrf_headers(client)
    member_headers = csrf_headers(member)
    invite = client.post(f"{path}/invites", headers=owner_headers).json["pin"]
    assert member.post("/api/households/join", headers=member_headers, json={"pin": invite}).status_code == 200
    assert client.post(f"{path}/invites", headers=owner_headers).status_code == 201
    appliance = client.post(f"{path}/appliances", headers=owner_headers,
                            json={"name": "Fan", "watts": 50, "hours_per_day": 2}).json["item"]["id"]
    saved = client.put(f"{path}/budget-planner/plan", headers=owner_headers, json={"month": "2026-11"})
    assert saved.status_code == 200
    plan_id = saved.json["saved_plan"]["id"]

    assert member.delete(path, headers=member_headers).status_code == 404
    assert client.delete(path, headers=owner_headers).status_code == 204
    assert member.get("/api/households").json["items"] == []
    assert member.get(f"{path}/appliances").status_code == 404
    assert db.session.get(Appliance, appliance) is None
    assert db.session.get(BudgetPlan, plan_id) is None
    assert db.session.get(HouseholdInvite, home) is None
    assert not db.session.query(HouseholdMember).filter_by(household_id=home).count()


def test_planner_manual_hours_sync_and_failed_changes_roll_back(client):
    assert register(client).status_code == 201
    home = make_household(client)
    headers = csrf_headers(client)
    path = f"/api/households/{home}"
    planner = f"{path}/budget-planner"
    appliances = f"{path}/appliances"
    item = client.post(appliances, headers=headers, json={
        "name": "AC", "watts": 1000, "hours_per_day": 8,
        "is_must_have": True, "standby_hours_per_day": 2,
    }).json["item"]
    appliance_id = item["id"]
    change = f"{planner}/hours/{appliance_id}"

    def edit(hours, extra=()):
        return client.patch(change, headers=headers, json={
            "month": "2026-11", "monthly_budget": 0,
            "adjustments": [{"appliance_id": appliance_id, "hours_per_day": hours}, *extra],
        })

    generated = client.post(f"{planner}/generate", headers=headers,
                            json={"month": "2026-11", "monthly_budget": 0})
    assert generated.json["plan"]["items"][0]["hours_per_day"] == 8
    updated = edit(7.5)
    assert updated.status_code == 200
    assert updated.json["plan"]["items"][0]["hours_per_day"] == 7.5
    assert updated.json["plan"]["items"][0]["max_hours_per_day"] == 22
    assert edit(0).status_code == 400
    assert edit(23).status_code == 400
    assert edit(6, [{"appliance_id": appliance_id + 1000, "hours_per_day": 1}]).status_code == 400
    assert client.get(appliances).json["items"][0]["hours_per_day"] == 7.5
    assert client.patch(f"{appliances}/{appliance_id}", headers=headers,
                        json={"hours_per_day": 0}).status_code == 400
