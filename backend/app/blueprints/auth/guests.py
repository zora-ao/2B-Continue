from datetime import datetime, timezone

from sqlalchemy import delete, exists, select

from ...extensions import db
from ...models import Appliance, Household, RefreshToken, User

GUEST_CLEANUP_BATCH = 50


def create_guest():
    guest = User()
    db.session.add(guest)
    db.session.flush()
    return guest


def delete_abandoned_guests(limit=GUEST_CLEANUP_BATCH):
    now = datetime.now(timezone.utc)
    usable_token = exists().where(RefreshToken.user_id == User.id,
                                  RefreshToken.expires_at > now,
                                  RefreshToken.used_at.is_(None))
    guest_ids = db.session.scalars(
        select(User.id).where(User.email.is_(None), ~usable_token)
        .order_by(User.created_at).limit(limit)).all()
    if not guest_ids:
        return 0
    households = select(Household.id).where(Household.user_id.in_(guest_ids))
    # Appliances have no ON DELETE CASCADE in the database, so remove them first.
    db.session.execute(delete(Appliance).where(Appliance.household_id.in_(households)))
    db.session.execute(delete(Household).where(Household.user_id.in_(guest_ids)))
    db.session.execute(delete(User).where(User.id.in_(guest_ids), User.email.is_(None)))
    return len(guest_ids)
