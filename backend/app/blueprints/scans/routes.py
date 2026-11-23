from flask import g, jsonify
from werkzeug.exceptions import RequestEntityTooLarge

from . import scans_bp
from .gemini import ScanError, read_rating_label
from .services import check_available, photo_bytes, poll_scan, start_scan, submit_photo


@scans_bp.after_request
def prevent_caching(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@scans_bp.errorhandler(ScanError)
def scan_error(error):
    return jsonify(error=str(error)), error.status


@scans_bp.errorhandler(RequestEntityTooLarge)
def photo_too_large(_error):
    return jsonify(error="Choose a photo smaller than 4 MB."), 413


@scans_bp.post("/scans/read")
def read_label():
    check_available("extract", g.user.id)
    return jsonify(read_rating_label(photo_bytes()))


@scans_bp.post("/scan-sessions")
def start_session():
    return jsonify(start_scan(g.user.id)), 201


@scans_bp.get("/scan-sessions/<code>")
def poll_session(code):
    return jsonify(poll_scan(g.user.id, code))


@scans_bp.post("/scan-sessions/<code>/photo")
def send_photo(code):
    submit_photo(code)
    return "", 204
