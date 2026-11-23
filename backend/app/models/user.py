from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class User(db.Model):

    __tablename__ = "users"
    __table_args__ = (db.UniqueConstraint("email", name="uq_users_email"),)

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    name: Mapped[str] = mapped_column(db.String(120), nullable=False)
    email: Mapped[str] = mapped_column(db.String(254), nullable=False)
    password_hash: Mapped[str] = mapped_column(db.String(255), nullable=False)
    failed_login_count: Mapped[int] = mapped_column(db.Integer, nullable=False, default=0,
                                                    server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
