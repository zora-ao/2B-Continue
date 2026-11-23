import hmac
import re
import secrets
from time import time_ns

from flask import abort, current_app, jsonify
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from ...errors import ValidationError
from ...extensions import db
from ...models import Household, HouseholdInvite, HouseholdJoinLimit, HouseholdMember, User


PIN_LIFETIME_MS = 60_000
MAX_JOIN_ATTEMPTS = 8
PIN_PATTERN = re.compile(r"[0-9]{8}")


def now_ms():
    return time_ns() // 1_000_000


def pin_digest(pin):
    return hmac.digest(current_app.config["SECRET_KEY"].encode(), pin.encode(), "sha256").hex()


def issue_invite(household_id, user_id):
    household = db.session.scalar(select(Household).where(
        Household.id == household_id, Household.user_id == user_id,
    ).with_for_update())
    if household is None:
        abort(404)

    current = db.session.get(HouseholdInvite, household_id)
    for _ in range(5):
        pin = f"{secrets.randbelow(100_000_000):08d}"
        digest = pin_digest(pin)
        if current and current.pin_digest == digest:
            continue
        try:
            with db.session.begin_nested():
                invite = current if current else HouseholdInvite(household_id=household_id)
                invite.pin_digest = digest
                invite.expires_at_ms = now_ms() + PIN_LIFETIME_MS
                db.session.add(invite)
        except IntegrityError:
            # The PIN namespace is shared by all households.
            if db.session.scalar(select(HouseholdInvite.household_id).where(
                HouseholdInvite.pin_digest == digest,
            )) is None:
                raise
            continue
        db.session.commit()
        response = jsonify(pin=pin, expires_in=PIN_LIFETIME_MS // 1000)
        response.headers["Cache-Control"] = "no-store"
        return response, 201
    return jsonify(error="Could not create a PIN. Try again."), 503


def record_attempt(user_id):
    # Serialize attempts from the same account across workers and browser tabs.
    db.session.execute(select(User.id).where(User.id == user_id).with_for_update()).scalar_one()
    now = now_ms()
    limit = db.session.get(HouseholdJoinLimit, user_id)
    if limit is None:
        db.session.add(HouseholdJoinLimit(user_id=user_id, window_ends_ms=now + 60_000, attempts=1))
    elif limit.window_ends_ms <= now:
        limit.window_ends_ms = now + 60_000
        limit.attempts = 1
    elif limit.attempts >= MAX_JOIN_ATTEMPTS:
        return False
    else:
        limit.attempts += 1
    db.session.commit()
    return True


def redeem_invite(user_id, pin):
    if not isinstance(pin, str) or PIN_PATTERN.fullmatch(pin) is None:
        raise ValidationError("Enter the 8-digit household PIN.")
    if not record_attempt(user_id):
        return None, ("Too many attempts. Try again in a minute.", 429)

    digest = pin_digest(pin)
    household_id = db.session.scalar(select(HouseholdInvite.household_id).where(
        HouseholdInvite.pin_digest == digest, HouseholdInvite.expires_at_ms > now_ms(),
    ))
    if household_id is not None:
        # Use the same lock order as regeneration and recheck expiry after acquiring the lock.
        household = db.session.get(Household, household_id, with_for_update=True)
        invite = db.session.get(HouseholdInvite, household_id) if household else None
        if invite and invite.pin_digest == digest and invite.expires_at_ms > now_ms():
            existing = db.session.get(HouseholdMember, (household_id, user_id))
            if user_id != household.user_id and existing is None:
                db.session.add(HouseholdMember(household_id=household_id, user_id=user_id))
                db.session.delete(invite)
                db.session.commit()
            return household, None
    return None, ("That PIN is invalid, expired, or already used. Ask for a new one.", 410)
