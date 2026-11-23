"""Add users, their refresh tokens, and an optional owner on households.

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
        sa.Column("name", sa.String(120)),
        sa.Column("email", sa.String(254)),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("failed_login_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("locked_until", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email", name="uq_users_email"),
        # Guests have no email or password; real accounts have both.
        sa.CheckConstraint("(email IS NULL) = (password_hash IS NULL)",
                           name="ck_users_guest_consistent"),
    )
    # Supabase exposes public tables through its Data API; RLS with no policies blocks that.
    op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("jti", sa.String(64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    op.execute("ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY")
    op.add_column("households", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_foreign_key("fk_households_user_id_users", "households", "users",
                          ["user_id"], ["id"])
    op.create_index("ix_households_user_id", "households", ["user_id"])


def downgrade():
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.execute("ALTER TABLE refresh_tokens DISABLE ROW LEVEL SECURITY")
    op.drop_table("refresh_tokens")
    op.drop_index("ix_households_user_id", table_name="households")
    op.drop_constraint("fk_households_user_id_users", "households", type_="foreignkey")
    op.drop_column("households", "user_id")
    op.execute("ALTER TABLE users DISABLE ROW LEVEL SECURITY")
    op.drop_table("users")
