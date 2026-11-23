from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..extensions import db

if TYPE_CHECKING:
    from .household import Household


class Appliance(db.Model):

    __tablename__ = "appliances"
    __table_args__ = (
        db.CheckConstraint("watts > 0", name="positive_watts"),
        db.CheckConstraint("quantity > 0", name="positive_quantity"),
        db.CheckConstraint("hours_per_day >= 0 AND hours_per_day <= 24",
                           name="valid_daily_hours"),
    )

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    household_id: Mapped[int] = mapped_column(db.Integer, db.ForeignKey("households.id"),
                             nullable=False, index=True)
    name: Mapped[str] = mapped_column(db.String(120), nullable=False)
    appliance_type: Mapped[str | None] = mapped_column(db.String(80))
    room: Mapped[str | None] = mapped_column(db.String(120))
    is_must_have: Mapped[bool] = mapped_column(db.Boolean, nullable=False, default=False,
                                             server_default=db.false())
    watts: Mapped[Decimal] = mapped_column(db.Numeric(12, 3), nullable=False)
    quantity: Mapped[int] = mapped_column(db.Integer, nullable=False, default=1)
    hours_per_day: Mapped[Decimal] = mapped_column(db.Numeric(6, 3), nullable=False)
    created_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))

    household: Mapped[Household] = relationship("Household", back_populates="appliances")
