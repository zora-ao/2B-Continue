import io
import json
from datetime import date
from decimal import Decimal
from urllib.error import URLError

import pytest

from app.blueprints.solar import places


def fake_urlopen(monkeypatch, payload, seen=None):
    def opener(request, timeout=None):
        if seen is not None:
            seen.append(request.full_url)
        return io.BytesIO(json.dumps(payload).encode())
    monkeypatch.setattr(places, "urlopen", opener)


def failing_urlopen(monkeypatch):
    def opener(request, timeout=None):
        raise URLError("offline")
    monkeypatch.setattr(places, "urlopen", opener)


@pytest.fixture(autouse=True)
def fresh_cache(app):
    places._cache.clear()
    with app.app_context():
        yield


def test_search_places_maps_results(monkeypatch):
    seen = []
    fake_urlopen(monkeypatch, {"results": [
        {"name": "Batangas City", "admin1": "Calabarzon", "latitude": 13.7565, "longitude": 121.0583}]}, seen)
    assert places.search_places("Batangas") == [
        {"name": "Batangas City", "region": "Calabarzon", "latitude": 13.76, "longitude": 121.06}]
    assert "countryCode=PH" in seen[0]


def test_search_places_no_results(monkeypatch):
    fake_urlopen(monkeypatch, {})
    assert places.search_places("zzzz") == []


def test_search_places_failure(monkeypatch):
    failing_urlopen(monkeypatch)
    with pytest.raises(places.PlaceSearchError):
        places.search_places("Batangas")


def test_yearly_sun_hours_mean(app, monkeypatch):
    monkeypatch.setitem(app.config, "SOLAR_WEATHER_ENABLED", True)
    fake_urlopen(monkeypatch, {"daily": {"shortwave_radiation_sum": [18.0, None, 18.72]}})
    assert places.yearly_sun_hours(Decimal("13.76"), Decimal("121.06"), date(2026, 11, 24)) == Decimal("5.10")


def test_yearly_sun_hours_disabled_or_failing(app, monkeypatch):
    assert places.yearly_sun_hours(Decimal("13.76"), Decimal("121.06"), date(2026, 11, 24)) is None
    monkeypatch.setitem(app.config, "SOLAR_WEATHER_ENABLED", True)
    failing_urlopen(monkeypatch)
    assert places.yearly_sun_hours(Decimal("13.76"), Decimal("121.06"), date(2026, 11, 24)) is None
