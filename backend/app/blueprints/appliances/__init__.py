from flask import Blueprint

appliances_bp = Blueprint("appliances", __name__)

from . import routes
