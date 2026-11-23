import hashlib
import secrets
from collections import deque
from datetime import datetime, timezone
from io import BytesIO
from threading import Lock
from time import monotonic, time

from flask import current_app, request
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import delete, select, update

from .gemini import ScanError, read_rating_label
from ...extensions import db
from ...models import ScanSession


MAX_PHOTO_BYTES = 4 * 1024 * 1024
SESSION_SECONDS = 300
_requests = deque()
_lock = Lock()


def digest(code):
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def check_available(action, client):
    if not current_app.config["GEMINI_API_KEY"]:
        raise ScanError("Appliance scanning is currently unavailable.", 503)
    now = monotonic()
    with _lock:
        while _requests and _requests[0][0] <= now - 60:
            _requests.popleft()
        matching = [key for _, kind, key in _requests if kind == action]
        if len(matching) >= 30 or matching.count(client) >= 6:
            raise ScanError("Too many scan requests. Try again in a minute.", 429)
        _requests.append((now, action, client))


def photo_bytes():
    request.max_content_length = MAX_PHOTO_BYTES + 64 * 1024
    photo = request.files.get("photo")
    if photo is None:
        raise ScanError("Choose a photo of the rating label.", 400)
    data = photo.stream.read(MAX_PHOTO_BYTES + 1)
    if len(data) > MAX_PHOTO_BYTES:
        raise ScanError("Choose a photo smaller than 4 MB.", 413)
    try:
        with Image.open(BytesIO(data), formats=("JPEG", "PNG", "WEBP")) as image:
            if image.width * image.height > 16_000_000:
                raise ScanError("Choose a smaller photo of the rating label.", 413)
            prepared = ImageOps.exif_transpose(image).convert("RGB")
            prepared.thumbnail((1600, 1600))
            output = BytesIO()
            prepared.save(output, format="JPEG", quality=90)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise ScanError("Choose a readable JPG, PNG, or WebP photo.", 400) from None


def start_scan(user_id):
    check_available("session", user_id)
    now = int(time())
    code = secrets.token_urlsafe(32)
    expires_at = now + SESSION_SECONDS
    db.session.execute(delete(ScanSession).where(ScanSession.expires_at <= now))
    db.session.add(ScanSession(
        code_digest=digest(code), user_id=user_id, expires_at=expires_at, status="waiting",
    ))
    db.session.commit()
    return {"code": code, "expires_at": datetime.fromtimestamp(expires_at, timezone.utc).isoformat()}


def poll_scan(user_id, code):
    session = db.session.scalar(select(ScanSession).where(
        ScanSession.code_digest == digest(code), ScanSession.user_id == user_id,
        ScanSession.expires_at > time(),
    ))
    if session is None:
        return {"status": "expired"}
    if session.status == "done":
        return {"status": "done", "result": session.result}
    return {"status": "waiting"}


def submit_photo(code):
    key = digest(code)
    session = db.session.get(ScanSession, key)
    if session is None or session.expires_at <= time():
        raise ScanError("This scan link has expired.", 410)
    if session.status != "waiting":
        raise ScanError("This scan link already has a photo.", 409)
    user_id = session.user_id
    db.session.rollback()
    check_available("extract", user_id)
    photo = photo_bytes()
    claimed = db.session.execute(update(ScanSession).where(
        ScanSession.code_digest == key, ScanSession.status == "waiting",
        ScanSession.expires_at > time(),
    ).values(status="reading")).rowcount
    db.session.commit()
    if not claimed:
        raise ScanError("This scan link is no longer available. Check your computer.", 409)
    try:
        result = read_rating_label(photo)
    except ScanError:
        db.session.execute(update(ScanSession).where(ScanSession.code_digest == key).values(status="waiting"))
        db.session.commit()
        raise
    saved = db.session.execute(update(ScanSession).where(
        ScanSession.code_digest == key, ScanSession.expires_at > time(),
    ).values(status="done", result=result)).rowcount
    db.session.commit()
    if not saved:
        raise ScanError("This scan link has expired.", 410)
