import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS


def create_app() -> Flask:
    """Application factory: builds and configures the Flask app."""
    load_dotenv()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False

    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": origins}})

    from .routes import api

    app.register_blueprint(api, url_prefix="/api")
    return app
