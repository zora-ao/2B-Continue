"""Add manual appliance form fields.

Revision ID: b781d9a4c203
Revises: fa2721062dba
"""
from alembic import op
import sqlalchemy as sa

revision = "b781d9a4c203"
down_revision = "fa2721062dba"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("appliances") as batch_op:
        batch_op.add_column(sa.Column("appliance_type", sa.String(80), nullable=True))
        batch_op.add_column(sa.Column("room", sa.String(120), nullable=True))
        batch_op.add_column(sa.Column("is_must_have", sa.Boolean(), nullable=False,
                                     server_default=sa.false()))


def downgrade():
    with op.batch_alter_table("appliances") as batch_op:
        batch_op.drop_column("is_must_have")
        batch_op.drop_column("room")
        batch_op.drop_column("appliance_type")
