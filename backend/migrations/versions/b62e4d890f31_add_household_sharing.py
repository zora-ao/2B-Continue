"""Add household memberships and short-lived invite PINs."""

from alembic import op
import sqlalchemy as sa

revision = "b62e4d890f31"
down_revision = "a5112026cafe"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "household_members",
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    )
    op.create_index("ix_household_members_user_id", "household_members", ["user_id"])
    op.create_table(
        "household_invites",
        sa.Column("household_id", sa.Integer(), sa.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("pin_digest", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at_ms", sa.BigInteger(), nullable=False),
    )
    op.create_index("ix_household_invites_expires_at_ms", "household_invites", ["expires_at_ms"])
    op.create_table(
        "household_join_limits",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("window_ends_ms", sa.BigInteger(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )
    for table in ("household_members", "household_invites", "household_join_limits"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("household_join_limits")
    op.drop_table("household_invites")
    op.drop_table("household_members")
