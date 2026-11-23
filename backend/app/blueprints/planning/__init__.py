from flask import Blueprint

planning_bp = Blueprint("planning", __name__)

from . import routes
