"""Add manual meter readings and solar generation logs.

Revision ID: d615c9e270ab
Revises: c942a7b18e50
"""
from alembic import op
import sqlalchemy as sa

revision = "d615c9e270ab"
down_revision = "c942a7b18e50"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "meter_readings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("consumption_kwh", sa.Numeric(15, 3)),
        sa.Column("meter_reading_kwh", sa.Numeric(15, 3)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", "date", name="uq_meter_household_date"),
        sa.CheckConstraint("(consumption_kwh IS NOT NULL AND meter_reading_kwh IS NULL) OR "
                           "(consumption_kwh IS NULL AND meter_reading_kwh IS NOT NULL)", name="ck_meter_one_input"),
        sa.CheckConstraint("consumption_kwh >= 0", name="ck_meter_consumption_positive"),
        sa.CheckConstraint("meter_reading_kwh >= 0", name="ck_meter_reading_positive"),
    )
    op.create_index("ix_meter_readings_household_id", "meter_readings", ["household_id"])
    op.create_table(
        "solar_generation",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("generation_kwh", sa.Numeric(15, 3), nullable=False),
        sa.Column("self_consumed_kwh", sa.Numeric(15, 3)),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", "date", name="uq_solar_household_date"),
        sa.CheckConstraint("generation_kwh >= 0", name="ck_solar_generation_positive"),
        sa.CheckConstraint("self_consumed_kwh >= 0 AND self_consumed_kwh <= generation_kwh",
                           name="ck_solar_self_consumed_range"),
    )
    op.create_index("ix_solar_generation_household_id", "solar_generation", ["household_id"])


def downgrade():
    op.drop_index("ix_solar_generation_household_id", table_name="solar_generation")
    op.drop_table("solar_generation")
    op.drop_index("ix_meter_readings_household_id", table_name="meter_readings")
    op.drop_table("meter_readings")
