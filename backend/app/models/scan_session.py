from sqlalchemy.orm import Mapped, mapped_column

from ..extensions import db


class ScanSession(db.Model):
    __tablename__ = "scan_sessions"

    code_digest: Mapped[str] = mapped_column(db.String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(db.ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[int] = mapped_column(db.BigInteger, index=True)
    status: Mapped[str] = mapped_column(db.String(10))
    result: Mapped[dict | None] = mapped_column(db.JSON)
