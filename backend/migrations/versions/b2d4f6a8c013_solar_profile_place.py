"""Store the solar location as a searched place instead of a fixed city key.

Revision ID: b2d4f6a8c013
Revises: a5112026cafe
"""
from decimal import Decimal

from alembic import op
import sqlalchemy as sa

revision = "b2d4f6a8c013"
down_revision = "a5112026cafe"
branch_labels = None
depends_on = None

# The fixed city list this replaces, copied here so the migration keeps working after it's gone.
# key: (name, latitude, longitude, sun_hours)
OLD_CITIES = {
    "metro_manila": ("Metro Manila", "14.60", "120.98", "4.5"),
    "baguio": ("Baguio", "16.40", "120.60", "4.0"),
    "tuguegarao": ("Tuguegarao", "17.61", "121.73", "4.6"),
    "legazpi": ("Legazpi", "13.14", "123.74", "4.3"),
    "iloilo": ("Iloilo City", "10.72", "122.56", "4.8"),
    "bacolod": ("Bacolod", "10.68", "122.95", "4.8"),
    "cebu": ("Cebu City", "10.32", "123.89", "5.0"),
    "cagayan_de_oro": ("Cagayan de Oro", "8.45", "124.63", "5.0"),
    "davao": ("Davao City", "7.19", "125.46", "5.0"),
    "zamboanga": ("Zamboanga City", "6.92", "122.08", "5.2"),
}
NEW_COLUMNS = ("location_name", "latitude", "longitude", "sun_hours", "sun_hours_estimated")


def upgrade():
    op.add_column("solar_profiles", sa.Column("location_name", sa.String(120)))
    op.add_column("solar_profiles", sa.Column("latitude", sa.Numeric(5, 2)))
    op.add_column("solar_profiles", sa.Column("longitude", sa.Numeric(6, 2)))
    op.add_column("solar_profiles", sa.Column("sun_hours", sa.Numeric(4, 2)))
    op.add_column("solar_profiles", sa.Column("sun_hours_estimated", sa.Boolean()))

    update = sa.text("UPDATE solar_profiles SET location_name = :name, latitude = :latitude, "
                     "longitude = :longitude, sun_hours = :sun_hours, sun_hours_estimated = true "
                     "WHERE location_key = :key")
    for key, (name, latitude, longitude, sun_hours) in OLD_CITIES.items():
        op.execute(update.bindparams(key=key, name=name, latitude=Decimal(latitude),
                                     longitude=Decimal(longitude), sun_hours=Decimal(sun_hours)))
    # Any key not in the list falls back to Metro Manila rather than failing the upgrade.
    name, latitude, longitude, sun_hours = OLD_CITIES["metro_manila"]
    op.execute(sa.text("UPDATE solar_profiles SET location_name = :name, latitude = :latitude, "
                       "longitude = :longitude, sun_hours = :sun_hours, sun_hours_estimated = true "
                       "WHERE location_name IS NULL").bindparams(
        name=name, latitude=Decimal(latitude), longitude=Decimal(longitude),
        sun_hours=Decimal(sun_hours)))

    for column in NEW_COLUMNS:
        op.alter_column("solar_profiles", column, nullable=False)
    op.drop_column("solar_profiles", "location_key")


def downgrade():
    op.add_column("solar_profiles", sa.Column("location_key", sa.String(40), nullable=False,
                                              server_default="metro_manila"))
    op.alter_column("solar_profiles", "location_key", server_default=None)
    for column in NEW_COLUMNS:
        op.drop_column("solar_profiles", column)
