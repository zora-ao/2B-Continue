"""Place search and yearly sunlight from Open-Meteo (free, no API key).

Search failures raise PlaceSearchError so the page can say so. Sunlight failures
return None, and the caller falls back to an estimate.
"""
import json
import time
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from http.client import HTTPException
from statistics import fmean
from threading import Lock
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
SEARCH_CACHE_SECONDS = 3600
SEARCH_CACHE_LIMIT = 500
# The archive lags a few days behind today.
ARCHIVE_LAG_DAYS = 5
YEAR_DAYS = 365
MJ_PER_KWH = 3.6
TWO_PLACES = Decimal("0.01")

_cache = {}
_lock = Lock()


class PlaceSearchError(Exception):
    pass


def _fetch(url, params):
    request = Request(f"{url}?{urlencode(params)}", headers={"User-Agent": "Kuryenta/1.0"})
    with urlopen(request, timeout=current_app.config.get("SOLAR_WEATHER_TIMEOUT", 5)) as response:
        return json.load(response)


def round_coordinate(value):
    return float(Decimal(str(value)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP))


def search_places(query):
    """Up to 8 Philippine places matching the query: [{name, region, latitude, longitude}]."""
    key = query.strip().lower()
    now = time.monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    try:
        payload = _fetch(GEOCODING_URL, {"name": query.strip(), "count": 8, "language": "en",
                                         "countryCode": "PH", "format": "json"})
        results, seen = [], set()
        for item in payload.get("results") or []:
            # A city and its province often share a name; people can't tell them apart, so keep the first.
            label = (item["name"], item.get("admin1"))
            if label in seen:
                continue
            seen.add(label)
            results.append({"name": item["name"], "region": item.get("admin1"),
                            "latitude": round_coordinate(item["latitude"]),
                            "longitude": round_coordinate(item["longitude"])})
    except (URLError, OSError, HTTPException, ValueError, KeyError, TypeError) as error:
        raise PlaceSearchError(str(error)) from error

    with _lock:
        if len(_cache) >= SEARCH_CACHE_LIMIT:
            _cache.clear()
        _cache[key] = (now + SEARCH_CACHE_SECONDS, results)
    return results


def yearly_sun_hours(latitude, longitude, today):
    """Mean daily peak sun hours over the last year, or None when it can't be worked out."""
    if not current_app.config.get("SOLAR_WEATHER_ENABLED", True):
        return None
    end = today - timedelta(days=ARCHIVE_LAG_DAYS)
    start = end - timedelta(days=YEAR_DAYS)
    try:
        payload = _fetch(ARCHIVE_URL, {"latitude": latitude, "longitude": longitude,
                                       "daily": "shortwave_radiation_sum",
                                       "timezone": "Asia/Manila",
                                       "start_date": start.isoformat(), "end_date": end.isoformat()})
        values = [value for value in payload["daily"]["shortwave_radiation_sum"] if value is not None]
    except Exception as error:  # Any failure means "estimate"; a save must never break on it.
        current_app.logger.warning("Yearly sunlight unavailable (%s); using the estimate.",
                                   type(error).__name__)
        return None
    if not values:
        return None
    # MJ/m² per day -> kWh/m² per day, which equals peak sun hours.
    return Decimal(str(fmean(values) / MJ_PER_KWH)).quantize(TWO_PLACES, rounding=ROUND_HALF_UP)
