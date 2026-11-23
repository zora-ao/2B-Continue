from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class HouseholdMember(db.Model):
    __tablename__ = "household_members"

    household_id: Mapped[int] = mapped_column(db.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, index=True)


class HouseholdInvite(db.Model):
    __tablename__ = "household_invites"

    household_id: Mapped[int] = mapped_column(db.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    pin_digest: Mapped[str] = mapped_column(db.String(64), unique=True)
    expires_at_ms: Mapped[int] = mapped_column(db.BigInteger, index=True)


class HouseholdJoinLimit(db.Model):
    __tablename__ = "household_join_limits"

    user_id: Mapped[int] = mapped_column(db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    window_ends_ms: Mapped[int] = mapped_column(db.BigInteger)
    attempts: Mapped[int] = mapped_column(db.Integer)
