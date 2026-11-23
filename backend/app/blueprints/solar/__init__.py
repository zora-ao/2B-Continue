from flask import Blueprint

solar_bp = Blueprint("solar", __name__)

from . import routes
