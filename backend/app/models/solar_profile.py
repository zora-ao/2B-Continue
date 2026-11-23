from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class SolarProfile(db.Model):
    """Per-household solar page settings: where it is, what it can spend, what it owns."""

    __tablename__ = "solar_profiles"
    __table_args__ = (
        db.UniqueConstraint("household_id", name="uq_solar_profiles_household_id"),
        db.CheckConstraint("install_budget IS NULL OR install_budget >= 0",
                           name="ck_solar_profile_budget"),
        db.CheckConstraint("system_kw IS NULL OR system_kw > 0", name="ck_solar_profile_kw"),
        db.CheckConstraint("panel_watts > 0", name="ck_solar_profile_panel_watts"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    location_key: Mapped[str] = mapped_column(db.String(40), nullable=False)
    install_budget: Mapped[Decimal | None] = mapped_column(db.Numeric(12, 2))
    system_kw: Mapped[Decimal | None] = mapped_column(db.Numeric(6, 3))
    panel_watts: Mapped[int] = mapped_column(db.Integer, nullable=False, default=550)
    updated_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
