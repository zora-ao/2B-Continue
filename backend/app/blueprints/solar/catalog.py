"""Static reference data for the Solar page.

Sun-hours for a household's place come from Open-Meteo (see places.py); the
fallback below is a rough Philippine average.
Prices are indicative installed costs for grid-tied residential systems.
"""
from decimal import Decimal

DEFAULT_PANEL_WATTS = 550

# System losses (inverter, wiring, heat, soiling) applied to ideal output.
PERFORMANCE_RATIO = Decimal("0.80")
# A system "covers the bill" when it offsets at least this share of usage.
FULL_COVERAGE = Decimal("0.95")
# Daily output below this share of expected output on a clear day raises an alert.
LOW_OUTPUT_RATIO = Decimal("0.70")
AVERAGE_MONTH_DAYS = Decimal(365) / 12

# Used until a household picks its place, and whenever yearly sunlight can't be fetched.
FALLBACK_SUN_HOURS = Decimal("4.5")
DEFAULT_PLACE = {"name": "Metro Manila", "latitude": Decimal("14.60"), "longitude": Decimal("120.98"),
                 "sun_hours": FALLBACK_SUN_HOURS}

SYSTEMS = [
    {"kw": "1", "panel_count": 2, "panel_watts": 550, "estimated_cost": "65000"},
    {"kw": "2", "panel_count": 4, "panel_watts": 550, "estimated_cost": "110000"},
    {"kw": "3", "panel_count": 6, "panel_watts": 550, "estimated_cost": "160000"},
]
