from datetime import date as Date, datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class MeterReading(db.Model):
    """End-of-day cumulative reading OR manually supplied daily consumption."""

    __tablename__ = "meter_readings"
    __table_args__ = (
        db.UniqueConstraint("household_id", "date", name="uq_meter_household_date"),
        db.CheckConstraint(
            "(consumption_kwh IS NOT NULL AND meter_reading_kwh IS NULL) OR "
            "(consumption_kwh IS NULL AND meter_reading_kwh IS NOT NULL)",
            name="ck_meter_one_input"),
        db.CheckConstraint("consumption_kwh >= 0", name="ck_meter_consumption_positive"),
        db.CheckConstraint("meter_reading_kwh >= 0", name="ck_meter_reading_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[Date] = mapped_column(db.Date, nullable=False)
    consumption_kwh: Mapped[Decimal | None] = mapped_column(db.Numeric(15, 3))
    meter_reading_kwh: Mapped[Decimal | None] = mapped_column(db.Numeric(15, 3))
    updated_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class SolarGeneration(db.Model):
    __tablename__ = "solar_generation"
    __table_args__ = (
        db.UniqueConstraint("household_id", "date", name="uq_solar_household_date"),
        db.CheckConstraint("generation_kwh >= 0", name="ck_solar_generation_positive"),
        db.CheckConstraint("self_consumed_kwh >= 0 AND self_consumed_kwh <= generation_kwh",
                           name="ck_solar_self_consumed_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[Date] = mapped_column(db.Date, nullable=False)
    generation_kwh: Mapped[Decimal] = mapped_column(db.Numeric(15, 3), nullable=False)
    self_consumed_kwh: Mapped[Decimal | None] = mapped_column(db.Numeric(15, 3))
    updated_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
