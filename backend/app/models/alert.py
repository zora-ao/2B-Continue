from datetime import date as Date, datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class AlertRules(db.Model):
    __tablename__ = "alert_rules"

    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), primary_key=True)
    daily_limit_exceeded: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    bill_over_budget: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    unusual_spike: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    wasteful_appliances: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    solar_underperforming: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    weekly_summary: Mapped[bool] = mapped_column(default=False, server_default=db.false())


class Alert(db.Model):
    __tablename__ = "alerts"
    __table_args__ = (
        db.UniqueConstraint("household_id", "event_key", name="uq_alert_household_event"),
        db.Index("ix_alert_household_month", "household_id", "month"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    household_id: Mapped[int] = mapped_column(
        db.ForeignKey("households.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[str] = mapped_column(db.String(7), nullable=False)
    event_key: Mapped[str] = mapped_column(db.String(120), nullable=False)
    rule: Mapped[str] = mapped_column(db.String(40), nullable=False)
    category: Mapped[str] = mapped_column(db.String(16), nullable=False)
    severity: Mapped[str] = mapped_column(db.String(16), nullable=False)
    title: Mapped[str] = mapped_column(db.String(255), nullable=False)
    message: Mapped[str] = mapped_column(db.Text, nullable=False)
    details: Mapped[dict] = mapped_column(db.JSON, nullable=False)
    action: Mapped[dict | None] = mapped_column(db.JSON)
    occurred_on: Mapped[Date] = mapped_column(db.Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True, server_default=db.true())
    read_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc), nullable=False)
