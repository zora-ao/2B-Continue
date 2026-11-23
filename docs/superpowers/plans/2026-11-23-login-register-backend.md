# Login & Register (backend) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add users, register/login/logout/me endpoints, and per-user ownership of households to the Flask API.

**Architecture:** A new `users` table plus a nullable `households.user_id` (additive migration). Flask's signed-cookie session holds `user_id`. One app-wide `before_request` hook requires login on every `/api` request except the public ones and returns 404 when the URL's `household_id` isn't owned by the user, so the existing blueprints stay untouched apart from `households`.

**Tech Stack:** Flask 3.1, Flask-SQLAlchemy 3.1, SQLAlchemy 2.0, Flask-Migrate/Alembic, Werkzeug 3.1 password hashing, Postgres (Supabase in prod, local PostgreSQL 18 for tests), pytest (new, dev-only).

**Spec:** `docs/superpowers/specs/2026-11-23-login-register-backend-design.md`

## Global Constraints

- Migration only **adds**: new `users` table, new nullable `households.user_id`, RLS enabled on `users` with no policies. No other existing table or column changes; no rows deleted.
- `down_revision = "e3a1c5d7f902"`.
- No new runtime dependencies. `pytest` goes in a new `backend/requirements-dev.txt` only.
- **Never point tests or `flask db upgrade` at Supabase or the backend on port 5000.** Tests read `TEST_DATABASE_URL`, and the conftest refuses any host other than `localhost` / `127.0.0.1`.
- Errors are `{"error": "..."}` JSON. Request bodies go through `json_payload()` from `app/errors.py`.
- Fixed messages: 401 `"Please log in."`, login 401 `"Email or password is incorrect."`, 409 `"An account with this email already exists."`, 429 `"Too many failed attempts. Try again in 15 minutes."`, 404 uses the existing `"Requested resource not found."`.
- Name 1–120 chars after trim; email trimmed + lowercased, ≤254 chars, exactly one `@` with text on both sides and a `.` in the domain part; password 8–128 chars (string), no other rules.
- Lockout: 5 failures → locked for 15 minutes; count resets on lock and on success.
- Session: `HttpOnly`, `SameSite=Lax`, `Secure` unless `FLASK_DEBUG == "1"`, permanent with 7-day lifetime. `SECRET_KEY` required at startup.
- Public endpoints: `auth.register`, `auth.login`, `auth.logout`, `api.health`. `OPTIONS` always passes.
- User JSON is exactly `{"id", "name", "email"}`.
- Commit messages: conventional style (`feat(backend): ...`), **no AI attribution lines** (`CLAUDE.md`).

## Review Focus

1. **Email case and whitespace:** registering `" Ana@Example.com "` then logging in with `"ana@example.com"` succeeds; registering `"ANA@example.com"` afterwards is 409. (Task 2, Task 3)
2. **Wrong JSON types:** `password: 12345678` (number), `email: null`, a missing field, or an extra key all give 400, never 500. (Task 2)
3. **Duplicate email under a race:** uniqueness relies on the DB constraint; an `IntegrityError` on insert becomes 409, not the generic 500 database handler. (Task 2)
4. **Stale session:** a cookie whose user row no longer exists gives 401 and clears the session. (Task 4)
5. **Legacy unowned households (`user_id IS NULL`):** invisible in the list and 404 on every household URL for every user. (Task 4)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/requirements-dev.txt` (create) | `-r requirements.txt` + `pytest>=8,<9` |
| `backend/tests/conftest.py` (create) | Throwaway-DB app/client fixtures, localhost guard, helpers |
| `backend/app/models/user.py` (create) | `User` model |
| `backend/app/models/household.py` (modify) | add `user_id` |
| `backend/app/models/__init__.py` (modify) | export `User` |
| `backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py` (create) | the additive migration |
| `backend/app/blueprints/auth/__init__.py` (create) | `auth_bp` |
| `backend/app/blueprints/auth/validation.py` (create) | input parsing for register/login |
| `backend/app/blueprints/auth/routes.py` (create) | register, login, logout, me |
| `backend/app/blueprints/auth/guard.py` (create) | `require_login` before_request hook |
| `backend/app/__init__.py` (modify) | SECRET_KEY, session config, register `auth_bp` and the hook |
| `backend/app/blueprints/households/routes.py` (modify) | scope list/create to `g.user` |
| `backend/.env.example`, `render.yaml`, `backend/README.md` (modify) | `SECRET_KEY`, Auth API docs |
| `backend/tests/test_models.py`, `test_auth.py`, `test_login.py`, `test_guard.py` (create) | tests |

---

### Task 1: Test harness, User model, household owner column, migration

**Files:**
- Create: `backend/requirements-dev.txt`, `backend/tests/__init__.py` (empty), `backend/tests/conftest.py`, `backend/tests/test_models.py`, `backend/app/models/user.py`, `backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py`
- Modify: `backend/app/models/household.py`, `backend/app/models/__init__.py`

**Interfaces:**
- Produces:
  - `app.models.User`: `__tablename__ = "users"`; `id: int`, `name: str` (String 120), `email: str` (String 254, unique, constraint name `uq_users_email`), `password_hash: str` (String 255), `failed_login_count: int` (default 0, server_default `"0"`), `locked_until: datetime | None` (DateTime tz), `created_at: datetime` (DateTime tz, default `datetime.now(timezone.utc)`).
  - `Household.user_id: int | None` = `mapped_column(db.Integer, db.ForeignKey("users.id"), index=True)` (nullable).
  - Fixtures in `tests/conftest.py`: `app` (function-scoped; tables created once per session, all rows deleted after each test), `client` (`app.test_client()`), and helpers `register(client, name="Ana", email="ana@example.com", password="correct-horse")` → response from `POST /api/auth/register`, `make_household(client, name="Home") -> int` → `POST /api/households` with `electricity_rate: 12, monthly_budget: 2000`, returns the new id. (The helpers are used from Task 2 on.)

- [ ] **Step 1: One-time local test database (the user runs this, it asks for their local `postgres` password)**

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres energywise_test
```

Then in the shell used for tests: `$env:TEST_DATABASE_URL = "postgresql://postgres:<local-password>@localhost:5432/energywise_test"`. Install dev deps: `venv\Scripts\python -m pip install -r requirements-dev.txt` (from `backend/`).

- [ ] **Step 2: Write `tests/conftest.py`**

Before importing the app: read `TEST_DATABASE_URL`; `pytest.exit(...)` if it's missing or `urllib.parse.urlsplit(url).hostname not in {"localhost", "127.0.0.1"}`. Set `os.environ["DATABASE_URL"] = url`, `os.environ["SECRET_KEY"] = "test-secret"`, `os.environ["FLASK_DEBUG"] = "1"` (these win over `backend/.env` because `load_dotenv` doesn't override). Build the app with `create_app({"TESTING": True, "SOLAR_WEATHER_ENABLED": False})`; `db.drop_all(); db.create_all()` once per session; after each test `db.session.remove()` then delete from every table in `reversed(db.metadata.sorted_tables)` and commit.

- [ ] **Step 3: Write the failing model tests in `tests/test_models.py`**

```python
def test_user_email_is_unique(app):
    db.session.add(User(name="A", email="a@example.com", password_hash="x"))
    db.session.commit()
    db.session.add(User(name="B", email="a@example.com", password_hash="y"))
    with pytest.raises(IntegrityError):
        db.session.commit()

def test_household_owner_is_optional(app):
    db.session.add(Household(name="Old", electricity_rate=12, monthly_budget=2000))
    db.session.commit()
    assert db.session.scalar(select(Household)).user_id is None

def test_user_defaults(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user); db.session.commit()
    assert user.failed_login_count == 0 and user.locked_until is None and user.created_at is not None
```

- [ ] **Step 4: Run and confirm failure**

Run (from `backend/`): `venv\Scripts\python -m pytest tests/test_models.py -q`
Expected: ImportError / collection error — `User` doesn't exist.

- [ ] **Step 5: Implement `User` (`app/models/user.py`, style of `household.py`), add `Household.user_id`, export `User` from `app/models/__init__.py`**

- [ ] **Step 6: Run and confirm pass**

Run: `venv\Scripts\python -m pytest tests/test_models.py -q` → Expected: `3 passed`.

- [ ] **Step 7: Write the migration `f4b2d8c61a37_add_users_and_household_owner.py`**

`revision = "f4b2d8c61a37"`, `down_revision = "e3a1c5d7f902"`. `upgrade()`: `op.create_table("users", ...)` matching the model (unique constraint `uq_users_email`); `op.execute("ALTER TABLE users ENABLE ROW LEVEL SECURITY")`; `op.add_column("households", sa.Column("user_id", sa.Integer(), nullable=True))`; `op.create_foreign_key("fk_households_user_id_users", "households", "users", ["user_id"], ["id"])`; `op.create_index("ix_households_user_id", "households", ["user_id"])`. `downgrade()` reverses in the opposite order (drop index, FK, column, then `ALTER TABLE users DISABLE ROW LEVEL SECURITY`, drop table).

- [ ] **Step 8: Verify the migration against a fresh throwaway DB, never Supabase**

```powershell
& "C:\Program Files\PostgreSQL\18\bin\createdb.exe" -U postgres energywise_migrate
$env:DATABASE_URL = "postgresql://postgres:<local-password>@localhost:5432/energywise_migrate"; $env:SECRET_KEY = "x"
venv\Scripts\flask --app app.py db upgrade
venv\Scripts\flask --app app.py db downgrade e3a1c5d7f902
venv\Scripts\flask --app app.py db upgrade
```

Expected: all three succeed with no errors. Then check `psql -U postgres -d energywise_migrate -c "select relrowsecurity from pg_class where relname='users'"` → `t`. (`SECRET_KEY` is only required from Task 2 on; setting it now is harmless.) Remove the env vars from the shell afterwards.

- [ ] **Step 9: Commit**

```powershell
git add backend/requirements-dev.txt backend/tests backend/app/models backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py docs/superpowers/specs/2026-11-23-login-register-backend-design.md docs/superpowers/plans/2026-11-23-login-register-backend.md
git commit -m "feat(backend): add users table and household owner column"
```

---

### Task 2: Session config, register, me, logout

**Files:**
- Create: `backend/app/blueprints/auth/__init__.py`, `validation.py`, `routes.py`, `backend/tests/test_auth.py`
- Modify: `backend/app/__init__.py`, `backend/.env.example`, `render.yaml`

**Interfaces:**
- Consumes: `User` (Task 1), `json_payload`, `ValidationError` from `app/errors.py`.
- Produces:
  - `auth_bp = Blueprint("auth", __name__)` mounted at `/api/auth` (endpoint names `auth.register`, `auth.login`, `auth.logout`, `auth.me`).
  - `validation.normalize_email(value) -> str` (raises `ValidationError`), `validate_registration(data: dict) -> dict` with keys `name`, `email`, `password`, and `validate_login(data: dict) -> tuple[str, str]` (email, password). Login validation only checks shape (keys exactly `email`, `password`, both strings, password ≤128); a malformed email at login is 401, not 400.
  - `routes.serialize_user(user) -> dict` → `{"id", "name", "email"}`.
  - `routes.start_session(user) -> None`: `session.clear()`, `session["user_id"] = user.id`, `session.permanent = True`.
  - Until Task 4 exists, `GET /me` reads `session.get("user_id")` itself and returns 401 `"Please log in."` when there's no matching user. Task 4 replaces that with `g.user`.

- [ ] **Step 1: Write failing tests in `tests/test_auth.py`**

```python
def test_register_creates_user_and_logs_in(client):
    r = register(client, name=" Ana ", email=" Ana@Example.com ")
    assert r.status_code == 201
    assert r.get_json() == {"user": {"id": ANY, "name": "Ana", "email": "ana@example.com"}}
    assert client.get("/api/auth/me").get_json()["user"]["email"] == "ana@example.com"

def test_password_is_hashed(app, client):
    register(client)
    assert db.session.scalar(select(User)).password_hash.startswith("scrypt:")

def test_duplicate_email_any_case_is_409(client):
    register(client)
    r = register(client, email="ANA@example.com")
    assert r.status_code == 409
    assert r.get_json() == {"error": "An account with this email already exists."}

@pytest.mark.parametrize("body", [
    {"name": "Ana", "email": "ana@example.com"},                                  # missing
    {"name": "Ana", "email": "ana@example.com", "password": 12345678},            # number
    {"name": "Ana", "email": None, "password": "correct-horse"},
    {"name": "", "email": "ana@example.com", "password": "correct-horse"},
    {"name": "x" * 121, "email": "ana@example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana.example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@@example.com", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@localhost", "password": "correct-horse"},
    {"name": "Ana", "email": "ana@example.com", "password": "short"},
    {"name": "Ana", "email": "ana@example.com", "password": "x" * 129},
    {"name": "Ana", "email": "ana@example.com", "password": "correct-horse", "is_admin": True},
])
def test_register_rejects_bad_input(client, body):
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 400 and "error" in r.get_json()

def test_me_without_session_is_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_logout_clears_session(client):
    register(client)
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401

def test_session_cookie_flags(client):
    cookie = register(client).headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie and "Expires=" in cookie

def test_cookie_secure_outside_debug(monkeypatch):
    monkeypatch.setenv("FLASK_DEBUG", "0")
    assert create_app().config["SESSION_COOKIE_SECURE"] is True

def test_secret_key_required(monkeypatch):
    monkeypatch.delenv("SECRET_KEY")
    with pytest.raises(ValueError):
        create_app()
```

(`ANY` is `unittest.mock.ANY`. The last two tests build their own app and never touch the DB.)

- [ ] **Step 2: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests/test_auth.py -q` → Expected: failures (404s on `/api/auth/...`, and the config tests fail).

- [ ] **Step 3: Implement**

- `create_app`: read `SECRET_KEY` from the environment, raising `ValueError("SECRET_KEY environment variable is not set")` if it's missing (next to the `DATABASE_URL` check). Set `SESSION_COOKIE_HTTPONLY=True`, `SESSION_COOKIE_SAMESITE="Lax"`, `SESSION_COOKIE_SECURE=os.getenv("FLASK_DEBUG") != "1"`, `PERMANENT_SESSION_LIFETIME=timedelta(days=7)` *before* `app.config.update(test_config)`. Register `auth_bp` at `/api/auth`.
- `validation.py`: as in Interfaces, same style as `households/routes.py` (reject unknown keys with a 400).
- `routes.py`: `register`: validate → `User(name, email, password_hash=generate_password_hash(password))` → add + commit; on `IntegrityError` do `db.session.rollback()` and return the 409 (no pre-check query, so a race also lands here). Then `start_session`, return 201 `{"user": ...}`. `logout`: `session.clear()`, return `("", 204)`. `me`: see Interfaces.
- `.env.example`: add `SECRET_KEY=change-me-to-a-long-random-string`. `render.yaml`: add an env var `SECRET_KEY` with `generateValue: true`.

- [ ] **Step 4: Run and confirm pass**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/app backend/tests backend/.env.example render.yaml
git commit -m "feat(backend): add register, me and logout endpoints"
```

---

### Task 3: Login with lockout

**Files:**
- Modify: `backend/app/blueprints/auth/routes.py`
- Create: `backend/tests/test_login.py`

**Interfaces:**
- Consumes: `validate_login`, `start_session`, `serialize_user` (Task 2); `User` (Task 1).
- Produces: `POST /api/auth/login` (`auth.login`). Module constants `MAX_FAILED_LOGINS = 5`, `LOCKOUT = timedelta(minutes=15)`, `DUMMY_HASH = generate_password_hash("not-a-real-password")` (computed once at import).

- [ ] **Step 1: Write failing tests in `tests/test_login.py`**

```python
def login(client, email="ana@example.com", password="correct-horse"):
    return client.post("/api/auth/login", json={"email": email, "password": password})

def test_login_success_normalizes_email(client):
    register(client); client.post("/api/auth/logout")
    r = login(client, email="  ANA@example.com ")
    assert r.status_code == 200 and r.get_json()["user"]["email"] == "ana@example.com"
    assert client.get("/api/auth/me").status_code == 200

@pytest.mark.parametrize("email,password", [("ana@example.com", "wrong-pass"), ("nobody@example.com", "correct-horse")])
def test_bad_credentials_same_message(client, email, password):
    register(client); client.post("/api/auth/logout")
    r = login(client, email, password)
    assert r.status_code == 401 and r.get_json() == {"error": "Email or password is incorrect."}

def test_bad_login_body_is_400(client):
    assert client.post("/api/auth/login", json={"email": "a@example.com"}).status_code == 400
    assert client.post("/api/auth/login", json={"email": "a@example.com", "password": 5}).status_code == 400

def test_fifth_failure_locks_even_correct_password(client):
    register(client); client.post("/api/auth/logout")
    for _ in range(5):
        assert login(client, password="wrong-pass").status_code == 401
    r = login(client)
    assert r.status_code == 429
    assert r.get_json() == {"error": "Too many failed attempts. Try again in 15 minutes."}

def test_lock_expires_and_success_resets(app, client):
    register(client); client.post("/api/auth/logout")
    for _ in range(5): login(client, password="wrong-pass")
    user = db.session.scalar(select(User))
    user.locked_until = datetime.now(timezone.utc) - timedelta(seconds=1); db.session.commit()
    assert login(client).status_code == 200
    db.session.refresh(user)
    assert user.failed_login_count == 0 and user.locked_until is None

def test_four_failures_then_success_resets_count(app, client):
    register(client); client.post("/api/auth/logout")
    for _ in range(4): login(client, password="wrong-pass")
    assert login(client).status_code == 200
    assert db.session.scalar(select(User)).failed_login_count == 0
```

- [ ] **Step 2: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests/test_login.py -q` → Expected: failures (405/404 on `/login`).

- [ ] **Step 3: Implement `login()` in `routes.py`**

Order: validate shape → `normalize_email` inside a try (a `ValidationError` there counts as an unknown email) → look up the user. No user: `check_password_hash(DUMMY_HASH, password)`, return 401. `locked_until` in the future: return 429 without checking the password. Wrong password: atomic increment

```python
count = db.session.execute(update(User).where(User.id == user.id)
    .values(failed_login_count=User.failed_login_count + 1)
    .returning(User.failed_login_count)).scalar_one()
```

If `count >= MAX_FAILED_LOGINS`, set `locked_until = now + LOCKOUT` and `failed_login_count = 0` in the same transaction. Commit, then return 401. Right password: reset count to 0 and `locked_until` to None, commit, `start_session`, return 200 `{"user": ...}`.

- [ ] **Step 4: Run and confirm pass**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass.

- [ ] **Step 5: Commit**

```powershell
git add backend/app/blueprints/auth/routes.py backend/tests/test_login.py
git commit -m "feat(backend): add login with failed-attempt lockout"
```

---

### Task 4: Central login + ownership check, scoped households, docs

**Files:**
- Create: `backend/app/blueprints/auth/guard.py`, `backend/tests/test_guard.py`
- Modify: `backend/app/__init__.py`, `backend/app/blueprints/auth/routes.py` (`me` uses `g.user`), `backend/app/blueprints/households/routes.py`, `backend/README.md`

**Interfaces:**
- Consumes: `User`, `Household.user_id` (Task 1); `auth.*` endpoints (Tasks 2–3).
- Produces: `guard.PUBLIC_ENDPOINTS = {"auth.register", "auth.login", "auth.logout", "api.health"}` and `guard.require_login() -> Response | None`, registered with `app.before_request(require_login)` in `create_app`. Sets `flask.g.user: User` on every authenticated `/api` request.

- [ ] **Step 1: Write failing tests in `tests/test_guard.py`**

```python
@pytest.mark.parametrize("path", ["/api/households", "/api/households/1/appliances",
                                  "/api/households/1/dashboard", "/api/households/1/alerts",
                                  "/api/households/1/budget-planner", "/api/households/1/solar"])
def test_protected_without_login_is_401(client, path):
    r = client.get(path)
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_public_endpoints_open(client):
    assert client.get("/api/health").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204

def test_preflight_not_blocked(client):
    r = client.options("/api/households", headers={"Origin": "http://localhost:5173",
                                                    "Access-Control-Request-Method": "GET"})
    assert r.status_code != 401

def test_households_scoped_to_owner(client):
    register(client, email="ana@example.com"); ana_home = make_household(client, "Ana home")
    client.post("/api/auth/logout")
    register(client, email="ben@example.com"); ben_home = make_household(client, "Ben home")
    items = client.get("/api/households").get_json()["items"]
    assert [h["id"] for h in items] == [ben_home]
    for path in (f"/api/households/{ana_home}/appliances", f"/api/households/{ana_home}/dashboard",
                 f"/api/households/{ana_home}/alerts"):
        r = client.get(path)
        assert r.status_code == 404 and r.get_json() == {"error": "Requested resource not found."}
    assert client.get(f"/api/households/{ben_home}/appliances").status_code == 200

def test_cannot_write_to_others_household(client):
    register(client, email="ana@example.com"); ana_home = make_household(client)
    client.post("/api/auth/logout"); register(client, email="ben@example.com")
    r = client.post(f"/api/households/{ana_home}/appliances",
                    json={"name": "Fan", "watts": 50, "hours_per_day": 4})
    assert r.status_code == 404

def test_new_household_is_owned(app, client):
    register(client); home = make_household(client)
    assert db.session.get(Household, home).user_id == db.session.scalar(select(User)).id

def test_legacy_unowned_household_hidden(app, client):
    legacy = Household(name="Old", electricity_rate=12, monthly_budget=2000)
    db.session.add(legacy); db.session.commit()
    register(client)
    assert client.get("/api/households").get_json()["items"] == []
    assert client.get(f"/api/households/{legacy.id}/appliances").status_code == 404

def test_session_for_deleted_user_is_401(app, client):
    register(client)
    db.session.execute(delete(User)); db.session.commit()
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/households").status_code == 401
```

- [ ] **Step 2: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests/test_guard.py -q` → Expected: the 401 and scoping tests fail (lists show every household; other users' URLs return 200).

- [ ] **Step 3: Implement**

- `require_login()`: return `None` unless `request.path.startswith("/api")`. Return `None` for `request.method == "OPTIONS"` and for `request.endpoint in PUBLIC_ENDPOINTS`. Load `db.session.get(User, session.get("user_id"))` (guard against a missing id). If there's no user: `session.clear()` and return `jsonify(error="Please log in."), 401`. Set `g.user`. If `(request.view_args or {}).get("household_id")` is present and `select(Household.id).where(Household.id == hid, Household.user_id == g.user.id)` finds nothing, call `abort(404)`.
- `create_app`: `app.before_request(require_login)`.
- `me`: return `{"user": serialize_user(g.user)}` (the guard now handles 401).
- `households/routes.py`: list `.where(Household.user_id == g.user.id)`; create with `Household(**values, user_id=g.user.id)`.
- `README.md`: add an "Auth API" section covering the endpoint table, request bodies, the user object, cookie behaviour and the 7-day lifetime, the lockout, the 401/404 rules, `SECRET_KEY` (local `.env` and Render), and the SQL to hand an old household to an account: `UPDATE households SET user_id = <user id> WHERE id = <household id>;`.

- [ ] **Step 4: Run the whole suite**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass.

- [ ] **Step 5: Manual check against a throwaway backend (never port 5000 / Supabase)**

With `DATABASE_URL` pointing at `energywise_migrate` (already upgraded in Task 1) and `SECRET_KEY` set, run `venv\Scripts\flask --app app.py run --port 5001`. Then, using a `curl.exe` cookie jar (`-c jar -b jar`): register → `GET /api/auth/me` 200 → `POST /api/households` 201 → `GET /api/households` lists only it → logout → `GET /api/households` 401. Expected: the codes as listed.

- [ ] **Step 6: Commit**

```powershell
git add backend/app backend/tests backend/README.md
git commit -m "feat(backend): require login and scope households to their owner"
```

PR notes to include when opening the PR (Summary / Testing / Notes): the deploy order with the frontend login PR, teammates' `.env` needing `SECRET_KEY`, the schema owner reviewing the migration, and that existing tables also have RLS off.
