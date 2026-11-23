"""Add saved monthly budget plans.

Revision ID: c942a7b18e50
Revises: b781d9a4c203
"""
from alembic import op
import sqlalchemy as sa

revision = "c942a7b18e50"
down_revision = "b781d9a4c203"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "budget_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("household_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.String(7), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("source_fingerprint", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("household_id", "month", name="uq_budget_plans_household_month"),
    )
    op.create_index("ix_budget_plans_household_id", "budget_plans", ["household_id"])


def downgrade():
    op.drop_index("ix_budget_plans_household_id", table_name="budget_plans")
    op.drop_table("budget_plans")
