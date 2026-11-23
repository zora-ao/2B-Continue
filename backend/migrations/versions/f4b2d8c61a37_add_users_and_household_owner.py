"""Add users and an optional owner on households.

Revision ID: f4b2d8c61a37
Revises: e3a1c5d7f902
"""
from alembic import op
import sqlalchemy as sa

revision = "f4b2d8c61a37"
down_revision = "e3a1c5d7f902"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    # Supabase exposes public tables through its Data API; RLS with no policies blocks that.
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.add_column("households", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_households_user_id_users", "households", "users",
                          ["user_id"], ["id"])
    op.create_index("ix_households_user_id", "households", ["user_id"])


def downgrade():
    op.drop_index("ix_households_user_id", table_name="households")
    op.drop_constraint("fk_households_user_id_users", "households", type_="foreignkey")
    op.drop_column("households", "user_id")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.drop_table("users")
