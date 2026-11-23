import os

from dotenv import load_dotenv
from flask import Flask
from flask_cors import CORS
from pathlib import Path

from .extensions import db, migrate


def create_app(test_config=None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    
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
    from . import models  
    migrate.init_app(app, db, directory=str(Path(__file__).resolve().parents[1] / "migrations"))

    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    CORS(app, resources={r"/api/*": {"origins": origins}})

    from .blueprints.api.routes import api

    app.register_blueprint(api, url_prefix="/api")
    return app
