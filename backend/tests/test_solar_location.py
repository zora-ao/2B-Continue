from decimal import Decimal

import pytest

from app.blueprints.solar import routes
from app.blueprints.solar.places import PlaceSearchError
from .conftest import csrf_headers, make_household, start_guest

BATANGAS = {"name": "Batangas City", "latitude": 13.7565, "longitude": 121.0583}


@pytest.fixture
def solar(client):
    assert start_guest(client).status_code in (200, 201)
    return f"/api/households/{make_household(client)}/solar"


def save_place(client, solar, place):
    return client.put(f"{solar}/profile", headers=csrf_headers(client), json={"location": place})


def test_default_location_is_metro_manila(client, solar):
    data = client.get(solar).get_json()
    assert data["profile"]["location"] == {
        "name": "Metro Manila", "latitude": 14.6, "longitude": 120.98, "sun_hours": 4.5,
        "sun_hours_estimated": True, "is_default": True}
    assert "locations" not in data


def test_save_place_uses_yearly_sun_hours(client, solar, monkeypatch):
    monkeypatch.setattr(routes, "yearly_sun_hours", lambda lat, lon, today: Decimal("5.10"))
    response = save_place(client, solar, BATANGAS)
    assert response.status_code == 201
    expected = {"name": "Batangas City", "latitude": 13.76, "longitude": 121.06, "sun_hours": 5.1,
                "sun_hours_estimated": False, "is_default": False}
    assert response.get_json()["item"]["location"] == expected
    assert client.get(solar).get_json()["recommendations"]["location"] == expected


def test_save_place_falls_back_when_sunlight_unavailable(client, solar, monkeypatch):
    monkeypatch.setattr(routes, "yearly_sun_hours", lambda lat, lon, today: None)
    location = save_place(client, solar, BATANGAS).get_json()["item"]["location"]
    assert location["sun_hours"] == 4.5
    assert location["sun_hours_estimated"] is True


def test_save_place_rejects_bad_input(client, solar):
    assert save_place(client, solar, {**BATANGAS, "latitude": 40}).status_code == 400
    assert save_place(client, solar, {**BATANGAS, "name": " "}).status_code == 400
    response = client.put(f"{solar}/profile", headers=csrf_headers(client), json={"location_key": "cebu"})
    assert response.status_code == 400


def test_places_search(client, solar, monkeypatch):
    item = {"name": "Batangas City", "region": "Calabarzon", "latitude": 13.76, "longitude": 121.06}
    monkeypatch.setattr(routes, "search_places", lambda query: [item] if query == "Batangas" else [])
    assert client.get(f"{solar}/places?q=Batangas").get_json() == {"items": [item]}
    assert client.get(f"{solar}/places?q=a").status_code == 400

    def broken(query):
        raise PlaceSearchError("offline")
    monkeypatch.setattr(routes, "search_places", broken)
    assert client.get(f"{solar}/places?q=Batangas").status_code == 502
