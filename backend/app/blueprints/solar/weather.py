"""Daily solar radiation from Open-Meteo (free, no API key).

Failures never break the Solar page: callers get None and fall back to the
location's average sun-hours.
"""
import json
import time
from datetime import date, timedelta
from decimal import Decimal
from threading import Lock
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
# The forecast endpoint serves roughly the last three months and the next 16 days.
FORECAST_PAST_DAYS = 90
FORECAST_FUTURE_DAYS = 15
# WMO weather codes 0-2: clear, mainly clear, partly cloudy.
SUNNY_CODES = {0, 1, 2}
MJ_PER_KWH = Decimal("3.6")

_cache = {}
_lock = Lock()


def _cache_seconds(end, today):
    return 6 * 3600 if end < today - timedelta(days=7) else 1800


def daily_weather(latitude, longitude, start, end, today):
    """Return {date: {"sun_hours": Decimal, "weather_code": int|None, "sunny": bool|None}} or None."""
    if not current_app.config.get("SOLAR_WEATHER_ENABLED", True):
        return None
    if start < today - timedelta(days=FORECAST_PAST_DAYS):
        url = ARCHIVE_URL
    else:
        url = FORECAST_URL
        end = min(end, today + timedelta(days=FORECAST_FUTURE_DAYS))
    if end < start:
        return {}
    key = (url, latitude, longitude, start, end)
    now = time.monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached and cached[0] > now:
            return cached[1]

    params = urlencode({"latitude": latitude, "longitude": longitude,
                        "daily": "shortwave_radiation_sum,weather_code",
                        "timezone": "Asia/Manila",
                        "start_date": start.isoformat(), "end_date": end.isoformat()})
    try:
        request = Request(f"{url}?{params}", headers={"User-Agent": "EnergyWise/1.0"})
        with urlopen(request, timeout=current_app.config.get("SOLAR_WEATHER_TIMEOUT", 5)) as response:
            payload = json.load(response)
        daily = payload["daily"]
        result = {}
        for day, radiation, code in zip(daily["time"], daily["shortwave_radiation_sum"],
                                        daily.get("weather_code") or [None] * len(daily["time"])):
            if radiation is None:
                continue
            result[date.fromisoformat(day)] = {
                # MJ/m² per day -> kWh/m² per day, which equals peak sun hours.
                "sun_hours": Decimal(str(radiation)) / MJ_PER_KWH,
                "weather_code": code,
                "sunny": code in SUNNY_CODES if code is not None else None,
            }
    except (URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
        current_app.logger.warning("Open-Meteo request failed (%s)", type(error).__name__)
        return None

    with _lock:
        _cache[key] = (now + _cache_seconds(end, today), result)
    return result
