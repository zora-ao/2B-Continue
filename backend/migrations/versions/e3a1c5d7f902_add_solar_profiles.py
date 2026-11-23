"""Add per-household solar profiles.

Revision ID: e3a1c5d7f902
Revises: d615c9e270ab
"""
from alembic import op
import sqlalchemy as sa

revision = "e3a1c5d7f902"
down_revision = "d615c9e270ab"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "solar_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("location_key", sa.String(40), nullable=False),
        sa.Column("install_budget", sa.Numeric(12, 2)),
        sa.Column("system_kw", sa.Numeric(6, 3)),
        sa.Column("panel_watts", sa.Integer(), nullable=False, server_default="550"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", name="uq_solar_profiles_household_id"),
        sa.CheckConstraint("install_budget IS NULL OR install_budget >= 0",
                           name="ck_solar_profile_budget"),
        sa.CheckConstraint("system_kw IS NULL OR system_kw > 0", name="ck_solar_profile_kw"),
        sa.CheckConstraint("panel_watts > 0", name="ck_solar_profile_panel_watts"),
    )


def downgrade():
    op.drop_table("solar_profiles")
