from flask import current_app, jsonify, request
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.exceptions import BadRequest, NotFound, UnsupportedMediaType

from .extensions import db


class ValidationError(ValueError):
    pass


def json_payload():
    try:
        data = request.get_json()
    except (BadRequest, UnsupportedMediaType):
        raise ValidationError("Send valid JSON with Content-Type application/json.") from None
    if not isinstance(data, dict):
        raise ValidationError("Send a JSON object.")
    return data


def register_error_handlers(app):
    @app.errorhandler(ValidationError)
    def invalid_input(error):
        return jsonify(error=str(error)), 400

    @app.errorhandler(NotFound)
    def not_found(error):
        return jsonify(error="Requested resource not found."), 404

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        current_app.logger.error("Database operation failed (%s)", type(error).__name__)
        return jsonify(error="Unable to complete the database operation. Please try again."), 500
