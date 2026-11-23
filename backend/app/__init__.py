import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, request
from flask_cors import CORS

from .blueprints.api.routes import api
from .blueprints.appliances import appliances_bp
from .blueprints.auth import auth_bp
from .blueprints.auth.guard import require_login
from .blueprints.auth.tokens import ACCESS_LIFETIME, REFRESH_LIFETIME, register_jwt_errors
from .blueprints.households import households_bp
from .blueprints.planning import planning_bp
from .blueprints.dashboard import dashboard_bp
from .blueprints.solar import solar_bp
from .blueprints.alerts import alerts_bp
from .blueprints.scans import scans_bp
from .errors import register_error_handlers
from .extensions import db, jwt, migrate


def create_app(test_config=None) -> Flask:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")

    app = Flask(__name__)
    app.json.sort_keys = False
    
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL environment variable is not set")
    if database_url.startswith(("postgres://", "postgresql://")):
        database_url = "postgresql+psycopg://" + database_url.split("://", 1)[1]

    secret_key = os.getenv("SECRET_KEY")
    if not secret_key:
        raise ValueError("SECRET_KEY environment variable is not set")
    if len(secret_key) < 32:
        raise ValueError("SECRET_KEY must be at least 32 characters (it signs login tokens)")

    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config.update(
        SECRET_KEY=secret_key,
        JWT_SECRET_KEY=secret_key,
        JWT_ALGORITHM="HS256",
        JWT_TOKEN_LOCATION=["cookies", "headers"],
        JWT_ACCESS_TOKEN_EXPIRES=ACCESS_LIFETIME,
        JWT_REFRESH_TOKEN_EXPIRES=REFRESH_LIFETIME,
        JWT_ACCESS_COOKIE_PATH="/api",
        JWT_REFRESH_COOKIE_PATH="/api/auth",
        JWT_COOKIE_SECURE=os.getenv("FLASK_DEBUG") != "1",
        JWT_COOKIE_SAMESITE="Lax",
        JWT_SESSION_COOKIE=False,
        JWT_COOKIE_CSRF_PROTECT=True,
        GEMINI_API_KEY=os.getenv("GEMINI_API_KEY"),
        GEMINI_SCAN_MODEL=os.getenv("GEMINI_SCAN_MODEL", "gemini-3.5-flash-lite"),
    )
    if test_config:
        app.config.update(test_config)

    db.init_app(app)
    from . import models  
    migrate.init_app(app, db, directory=str(Path(__file__).resolve().parents[1] / "migrations"))

    register_error_handlers(app)
    jwt.init_app(app)
    register_jwt_errors(jwt)
    @app.before_request
    def authenticate_request():
        if request.endpoint != "scans.send_photo":
            return require_login()

    origins = [origin.strip() for origin in
               os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}})

    app.register_blueprint(api, url_prefix="/api")
    app.register_blueprint(scans_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(appliances_bp, url_prefix="/api/households/<int:household_id>/appliances")
    app.register_blueprint(households_bp, url_prefix="/api/households")
    app.register_blueprint(planning_bp, url_prefix="/api/households/<int:household_id>/budget-planner")
    app.register_blueprint(dashboard_bp, url_prefix="/api/households/<int:household_id>/dashboard")
    app.register_blueprint(solar_bp, url_prefix="/api/households/<int:household_id>/solar")
    app.register_blueprint(alerts_bp, url_prefix="/api/households/<int:household_id>/alerts")
    return app
