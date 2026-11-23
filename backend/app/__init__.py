import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS

from .blueprints.api.routes import api
from .blueprints.appliances import appliances_bp
from .blueprints.households import households_bp
from .errors import register_error_handlers
from .extensions import db, migrate


def create_app(test_config=None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    app = Flask(__name__)
    app.json.sort_keys = False
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    if database_url.startswith(("postgres://", "postgresql://")):
        database_url = "postgresql+psycopg://" + database_url.split("://", 1)[1]

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    from . import models  # Register all models for migrations.
    migrate.init_app(app, db, directory=str(Path(__file__).resolve().parents[1] / "migrations"))

    register_error_handlers(app)

    origins = [origin.strip() for origin in
               os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    app.register_blueprint(api, url_prefix="/api")
    app.register_blueprint(appliances_bp, url_prefix="/api/households/<int:household_id>/appliances")
    app.register_blueprint(households_bp, url_prefix="/api/households")
    return app
