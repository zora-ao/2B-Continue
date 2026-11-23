from flask import Blueprint

alerts_bp = Blueprint("alerts", __name__)

from . import routes
