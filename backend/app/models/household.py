from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db

if TYPE_CHECKING:
    from .appliance import Appliance


class Household(db.Model):

    __tablename__ = "households"
    __table_args__ = (
        db.CheckConstraint("electricity_rate > 0", name="positive_rate"),
        db.CheckConstraint("monthly_budget >= 0", name="nonnegative_budget"),
    )

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    name: Mapped[str] = mapped_column(db.String(120), nullable=False)
    user_id: Mapped[int | None] = mapped_column(db.Integer, db.ForeignKey("users.id"), index=True)
    location: Mapped[str | None] = mapped_column(db.String(255))
    electricity_rate: Mapped[Decimal] = mapped_column(db.Numeric(12, 4), nullable=False)
    monthly_budget: Mapped[Decimal] = mapped_column(db.Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))

    appliances: Mapped[list[Appliance]] = relationship("Appliance", back_populates="household",
                                 cascade="all, delete-orphan")
