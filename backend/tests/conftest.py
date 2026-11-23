import os
from urllib.parse import urlsplit

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit("Set TEST_DATABASE_URL to a throwaway local Postgres database.", returncode=2)
if urlsplit(TEST_DATABASE_URL).hostname not in {"localhost", "127.0.0.1"}:
    pytest.exit("TEST_DATABASE_URL must point at localhost, never a shared database.", returncode=2)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ["SECRET_KEY"] = "test-secret"
os.environ["FLASK_DEBUG"] = "1"

from app import create_app  # noqa: E402
from app.extensions import db  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    app = create_app({"TESTING": True, "SOLAR_WEATHER_ENABLED": False})
    with app.app_context():
        db.drop_all()
        db.create_all()
    return app


@pytest.fixture
def app(_app):
    with _app.app_context():
        yield _app
        db.session.remove()
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        db.session.commit()


@pytest.fixture
def client(app):
    return app.test_client()


def register(client, name="Ana", email="ana@example.com", password="correct-horse"):
    return client.post("/api/auth/register",
                       json={"name": name, "email": email, "password": password})


def make_household(client, name="Home"):
    response = client.post("/api/households",
                           json={"name": name, "electricity_rate": 12, "monthly_budget": 2000})
    return response.get_json()["item"]["id"]
