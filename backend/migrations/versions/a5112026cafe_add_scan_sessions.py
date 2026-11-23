"""Add temporary appliance label scan sessions."""

from alembic import op
import sqlalchemy as sa


revision = "a5112026cafe"
down_revision = "a7c3e9f15b20"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "scan_sessions",
        sa.Column("code_digest", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("result", sa.JSON()),
    )
    op.create_index("ix_scan_sessions_user_id", "scan_sessions", ["user_id"])
    op.create_index("ix_scan_sessions_expires_at", "scan_sessions", ["expires_at"])
    op.execute("ALTER TABLE scan_sessions ENABLE ROW LEVEL SECURITY")


def downgrade():
    op.drop_table("scan_sessions")
