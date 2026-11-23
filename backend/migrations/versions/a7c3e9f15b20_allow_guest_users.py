"""Allow guest users: no name, email, or password.

Revision ID: a7c3e9f15b20
Revises: f4b2d8c61a37
"""
from alembic import op
import sqlalchemy as sa

revision = "a7c3e9f15b20"
down_revision = "f4b2d8c61a37"
branch_labels = None
depends_on = None

COLUMNS = (("name", 120), ("email", 254), ("password_hash", 255))


def upgrade():
    for column, length in COLUMNS:
        op.alter_column("users", column, existing_type=sa.String(length), nullable=True)
    # Guests have no email or password; real accounts have both.
    op.create_check_constraint("ck_users_guest_consistent", "users",
                               "(email IS NULL) = (password_hash IS NULL)")


def downgrade():
    # Fails while guest rows exist, rather than deleting their data.
    op.drop_constraint("ck_users_guest_consistent", "users", type_="check")
    for column, length in COLUMNS:
        op.alter_column("users", column, existing_type=sa.String(length), nullable=False)
