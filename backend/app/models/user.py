from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class User(db.Model):

    __tablename__ = "users"
    __table_args__ = (
        db.UniqueConstraint("email", name="uq_users_email"),
        db.CheckConstraint("(email IS NULL) = (password_hash IS NULL)",
                           name="ck_users_guest_consistent"),
    )

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    name: Mapped[str | None] = mapped_column(db.String(120))
    email: Mapped[str | None] = mapped_column(db.String(254))
    password_hash: Mapped[str | None] = mapped_column(db.String(255))
    failed_login_count: Mapped[int] = mapped_column(db.Integer, nullable=False, default=0,
                                                    server_default="0")
    locked_until: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))

    @property
    def is_guest(self):
        return self.email is None
