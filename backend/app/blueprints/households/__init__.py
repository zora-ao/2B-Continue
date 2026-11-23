from flask import Blueprint

households_bp = Blueprint("households", __name__)

from . import routes
