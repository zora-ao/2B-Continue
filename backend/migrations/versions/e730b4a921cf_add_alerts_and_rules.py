"""Add persisted alerts, household rules, and optional evidence fields.

Revision ID: e730b4a921cf
Revises: d615c9e270ab
"""
from alembic import op
import sqlalchemy as sa

revision = "e730b4a921cf"
down_revision = "d615c9e270ab"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("appliances") as batch:
        batch.add_column(sa.Column("standby_watts", sa.Numeric(12, 3)))
        batch.add_column(sa.Column("standby_hours_per_day", sa.Numeric(6, 3), nullable=False, server_default="0"))
        batch.create_check_constraint("ck_appliance_standby_watts", "standby_watts >= 0")
        batch.create_check_constraint("ck_appliance_standby_hours", "standby_hours_per_day >= 0 AND hours_per_day + standby_hours_per_day <= 24")
    with op.batch_alter_table("solar_generation") as batch:
        batch.add_column(sa.Column("expected_generation_kwh", sa.Numeric(15, 3)))
        batch.create_check_constraint("ck_solar_expected_positive", "expected_generation_kwh >= 0")
    op.create_table(
        "alert_rules",
        sa.Column("household_id", sa.Integer(), primary_key=True),
        sa.Column("daily_limit_exceeded", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("bill_over_budget", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("unusual_spike", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("wasteful_appliances", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("solar_underperforming", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("weekly_summary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
    )
    op.create_table(
        "alerts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("event_key", sa.String(120), nullable=False),
        sa.Column("rule", sa.String(40), nullable=False),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("action", sa.JSON()),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.Column("resolved_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", "event_key", name="uq_alert_household_event"),
    )
    op.create_index("ix_alert_household_month", "alerts", ["household_id", "month"])


def downgrade():
    op.drop_index("ix_alert_household_month", table_name="alerts")
    op.drop_table("alerts")
    op.drop_table("alert_rules")
    with op.batch_alter_table("solar_generation") as batch:
        batch.drop_constraint("ck_solar_expected_positive", type_="check")
        batch.drop_column("expected_generation_kwh")
    with op.batch_alter_table("appliances") as batch:
        batch.drop_constraint("ck_appliance_standby_hours", type_="check")
        batch.drop_constraint("ck_appliance_standby_watts", type_="check")
        batch.drop_column("standby_hours_per_day")
        batch.drop_column("standby_watts")
