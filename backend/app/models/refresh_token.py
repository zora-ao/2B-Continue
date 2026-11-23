from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class RefreshToken(db.Model):

    __tablename__ = "refresh_tokens"
    __table_args__ = (db.UniqueConstraint("jti", name="uq_refresh_tokens_jti"),)

    id: Mapped[int] = mapped_column(db.Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    jti: Mapped[str] = mapped_column(db.String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
