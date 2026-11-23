from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class BudgetPlan(db.Model):
    """One saved, server-calculated plan per household and calendar month."""

    __tablename__ = "budget_plans"
    __table_args__ = (db.UniqueConstraint("household_id", "month",
                                          name="uq_budget_plans_household_month"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    month: Mapped[str] = mapped_column(db.String(7), nullable=False)
    snapshot: Mapped[dict] = mapped_column(db.JSON, nullable=False)
    source_fingerprint: Mapped[str] = mapped_column(db.String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
