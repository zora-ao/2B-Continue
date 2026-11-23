"""Static reference data for the Solar page.

Sun-hours are approximate annual-average peak sun hours (kWh/m²/day) for each
city and are used when live weather is unavailable and for long-run estimates.
Prices are indicative installed costs for grid-tied residential systems.
"""
from decimal import Decimal

DEFAULT_LOCATION = "metro_manila"
DEFAULT_PANEL_WATTS = 550

# System losses (inverter, wiring, heat, soiling) applied to ideal output.
PERFORMANCE_RATIO = Decimal("0.80")
# A system "covers the bill" when it offsets at least this share of usage.
FULL_COVERAGE = Decimal("0.95")
# Daily output below this share of expected output on a clear day raises an alert.
LOW_OUTPUT_RATIO = Decimal("0.70")
AVERAGE_MONTH_DAYS = Decimal(365) / 12

LOCATIONS = {
    "metro_manila": {"name": "Metro Manila", "latitude": 14.5995, "longitude": 120.9842, "sun_hours": "4.5"},
    "baguio": {"name": "Baguio", "latitude": 16.4023, "longitude": 120.5960, "sun_hours": "4.0"},
    "tuguegarao": {"name": "Tuguegarao", "latitude": 17.6132, "longitude": 121.7270, "sun_hours": "4.6"},
    "legazpi": {"name": "Legazpi", "latitude": 13.1391, "longitude": 123.7438, "sun_hours": "4.3"},
    "iloilo": {"name": "Iloilo City", "latitude": 10.7202, "longitude": 122.5621, "sun_hours": "4.8"},
    "bacolod": {"name": "Bacolod", "latitude": 10.6765, "longitude": 122.9509, "sun_hours": "4.8"},
    "cebu": {"name": "Cebu City", "latitude": 10.3157, "longitude": 123.8854, "sun_hours": "5.0"},
    "cagayan_de_oro": {"name": "Cagayan de Oro", "latitude": 8.4542, "longitude": 124.6319, "sun_hours": "5.0"},
    "davao": {"name": "Davao City", "latitude": 7.1907, "longitude": 125.4553, "sun_hours": "5.0"},
    "zamboanga": {"name": "Zamboanga City", "latitude": 6.9214, "longitude": 122.0790, "sun_hours": "5.2"},
}

SYSTEMS = [
    {"kw": "1", "panel_count": 2, "panel_watts": 550, "estimated_cost": "65000"},
    {"kw": "2", "panel_count": 4, "panel_watts": 550, "estimated_cost": "110000"},
    {"kw": "3", "panel_count": 6, "panel_watts": 550, "estimated_cost": "160000"},
]


def serialize_location(key):
    location = LOCATIONS[key]
    return {"key": key, "name": location["name"], "sun_hours": float(location["sun_hours"]),
            "latitude": location["latitude"], "longitude": location["longitude"]}
