# Login & Register — JWT Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the branch's Flask-session login with JWTs (15-minute access token, sliding 30-day rotating refresh token) that serve both the web app (HttpOnly cookies + CSRF) and the mobile app (Bearer header).

**Architecture:** `flask-jwt-extended` issues and verifies tokens. A small `tokens.py` owns issuing, the web/mobile reply shape and rotation. Refresh tokens are tracked by `jti` in a new `refresh_tokens` table. The existing app-wide `before_request` guard keeps its job (login required, household ownership) but reads the access token instead of the session. Validation, hashing, lockout and the households scoping already on the branch stay as they are.

**Tech Stack:** Flask 3.1, flask-jwt-extended ≥4.7 (PyJWT), Flask-SQLAlchemy 3.1, Alembic, Postgres (Supabase in prod, a throwaway local cluster for tests), pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-login-register-backend-design.md` (JWT revision)

**Starting point:** branch `feat/login-register-back` at `5ce54ed`. Its cookie-session version is already done and tested (46 tests): `app/models/user.py`, `Household.user_id`, migration `f4b2d8c61a37`, `app/blueprints/auth/{__init__,validation,routes,guard}.py`, `tests/{conftest,test_models,test_auth,test_login,test_guard}.py`. This plan changes those files; it doesn't start over.

## Global Constraints

- Migration **only adds**, and `f4b2d8c61a37` is **edited in place** (never applied anywhere shared). `down_revision = "e3a1c5d7f902"`.
- RLS is enabled with no policies on `users` **and** `refresh_tokens`.
- One new runtime dependency: `flask-jwt-extended>=4.7,<5` in `backend/requirements.txt`. Tokens are signed with `SECRET_KEY`, HS256.
- Access token: 15 minutes. Refresh token: 30 days, a fresh 30 days on every refresh (sliding). Refresh grace window: 30 seconds.
- Token payload: `sub` = `str(user.id)` plus the library's standard claims. **No name or email.**
- Web cookies: `JWT_TOKEN_LOCATION = ["cookies", "headers"]`; access cookie path `/api`; refresh cookie path `/api/auth`; CSRF cookies keep the default path `/`; `HttpOnly`, `SameSite=Lax`, `Secure` unless `FLASK_DEBUG == "1"`; `JWT_SESSION_COOKIE = False` with an explicit cookie `max_age` of 30 days; `JWT_COOKIE_CSRF_PROTECT = True`.
- `X-Client: mobile` matters only on register and login. On refresh and logout, the reply carrier follows `get_jwt_request_location()`.
- Public endpoints: `auth.register`, `auth.login`, `auth.refresh`, `auth.logout`, `api.health`; `OPTIONS` always passes.
- Fixed messages: 401 `"Please log in."` (every JWT error, plus a missing user); 401 `"Email or password is incorrect."`; 409 `"An account with this email already exists."`; 409 `"Refresh already used."`; 429 `"Too many failed attempts. Try again in 15 minutes."`; 404 `"Requested resource not found."`.
- User JSON is exactly `{"id", "name", "email"}`. A web token reply body is `{"user"}`; a mobile token reply body is exactly `{"user", "access_token", "refresh_token"}`.
- **Tests only ever touch a localhost DB** (the conftest guard stays). Never Supabase, never port 5000.
- Commit messages: `feat(backend): ...` style, **no AI attribution lines** (`CLAUDE.md`).

## Review Focus

1. **CSRF on web writes:** a cookie-authenticated POST/PATCH/DELETE without `X-CSRF-TOKEN` must be 401, while the same request from mobile with a Bearer token needs no CSRF header. (Task 2)
2. **Wrong token type:** a refresh token sent as the access token (Bearer on `/api/households`) and an access token sent to `/refresh` must both be 401, not 200 or 422. (Task 2, Task 3)
3. **Expired access token:** 401 with the spec's JSON, not the library's `{"msg": ...}` or a 422, so the apps' "refresh on 401" rule fires. (Task 2)
4. **Deleted user still holding valid tokens:** the access token gets 401, and refresh gets 401 because the rows cascaded away. (Task 2, Task 3)
5. **Token contents:** a decoded access token holds no name or email. (Task 2)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/requirements.txt` (modify) | add `flask-jwt-extended>=4.7,<5` |
| `backend/app/extensions.py` (modify) | `jwt = JWTManager()` |
| `backend/app/models/refresh_token.py` (create) | `RefreshToken` model |
| `backend/app/models/__init__.py` (modify) | export `RefreshToken` |
| `backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py` (modify in place) | add `refresh_tokens` and its RLS |
| `backend/app/blueprints/auth/tokens.py` (create) | lifetimes, `issue_tokens`, `token_response`, `wants_mobile`, `register_jwt_errors` |
| `backend/app/blueprints/auth/routes.py` (modify) | register/login issue tokens; new refresh; logout revokes; drop the `session` code |
| `backend/app/blueprints/auth/guard.py` (modify) | verify the access token instead of the session; add `auth.refresh` to the public list |
| `backend/app/__init__.py` (modify) | JWT config instead of the `SESSION_*` config; `jwt.init_app`, error handlers |
| `backend/README.md` (modify) | rewrite the "Auth API" section |
| `backend/tests/conftest.py` (modify) | CSRF helpers |
| `backend/tests/test_models.py`, `test_auth.py`, `test_login.py`, `test_guard.py` (modify), `test_tokens.py`, `test_refresh.py` (create) | tests |

---

### Task 1: Dependency, RefreshToken model, migration

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/models/__init__.py`, `backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py`, `backend/tests/test_models.py`
- Create: `backend/app/models/refresh_token.py`

**Interfaces:**
- Produces: `app.models.RefreshToken`: `__tablename__ = "refresh_tokens"`; `id: int`; `user_id: int` = `mapped_column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)`; `jti: str` (String 64, unique, constraint `uq_refresh_tokens_jti`); `expires_at: datetime` (DateTime tz, not null); `used_at: datetime | None` (DateTime tz); `created_at: datetime` (DateTime tz, default `datetime.now(timezone.utc)`).

- [ ] **Step 1: Throwaway test database (if not already running)**

Start a disposable cluster on port 5433, with its data dir in the session scratchpad:
- `initdb.exe -D <scratch>\pgdata -U postgres -A trust -E UTF8`
- `pg_ctl.exe -D <scratch>\pgdata -o "-p 5433" -l <scratch>\pg.log -w start`
- `createdb.exe -h localhost -p 5433 -U postgres energywise_test`, and the same again for `energywise_migrate`

The tools are in `C:\Program Files\PostgreSQL\18\bin`. Then:
- install the dependency: `venv\Scripts\python -m pip install "flask-jwt-extended>=4.7,<5"` (from `backend/`);
- set `TEST_DATABASE_URL=postgresql://postgres@localhost:5433/energywise_test` for every test run below.

- [ ] **Step 2: Write failing tests (append to `tests/test_models.py`)**

```python
def test_refresh_token_jti_unique(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user); db.session.commit()
    soon = datetime.now(timezone.utc) + timedelta(days=30)
    db.session.add(RefreshToken(user_id=user.id, jti="j1", expires_at=soon)); db.session.commit()
    db.session.add(RefreshToken(user_id=user.id, jti="j1", expires_at=soon))
    with pytest.raises(IntegrityError):
        db.session.commit()
    db.session.rollback()

def test_refresh_tokens_deleted_with_user(app):
    user = User(name="A", email="a@example.com", password_hash="x")
    db.session.add(user); db.session.commit()
    db.session.add(RefreshToken(user_id=user.id, jti="j1",
                                expires_at=datetime.now(timezone.utc) + timedelta(days=30)))
    db.session.commit()
    db.session.execute(delete(User)); db.session.commit()
    assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 0
```

- [ ] **Step 3: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests/test_models.py -q` → Expected: ImportError, because `RefreshToken` doesn't exist yet.

- [ ] **Step 4: Implement the model, the export, and the requirements line**

- [ ] **Step 5: Run and confirm pass**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass (48).

- [ ] **Step 6: Edit migration `f4b2d8c61a37` in place**

- `upgrade()`, after `users` and its RLS: `op.create_table("refresh_tokens", ...)` matching the model. That means the FK `ondelete="CASCADE"`, `sa.UniqueConstraint("jti", name="uq_refresh_tokens_jti")`, `op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])` and `ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY`.
- `downgrade()` removes `refresh_tokens` first (index, RLS off, drop table), then does what it already does.
- Update the docstring to mention refresh tokens.

- [ ] **Step 7: Verify the migration on `energywise_migrate` only**

With `DATABASE_URL=postgresql://postgres@localhost:5433/energywise_migrate` and `SECRET_KEY=x`, run `flask --app app.py db upgrade`, then `db downgrade e3a1c5d7f902`, then `db upgrade`.
Expected: each exits 0. Then `psql -h localhost -p 5433 -U postgres -d energywise_migrate -tAc "select relname, relrowsecurity from pg_class where relname in ('users','refresh_tokens') order by 1"` prints `refresh_tokens|t` and `users|t`.

- [ ] **Step 8: Commit**

```powershell
git add backend/requirements.txt backend/app/models backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py backend/tests/test_models.py docs/superpowers/specs/2026-11-23-login-register-backend-design.md docs/superpowers/plans/2026-11-23-login-register-jwt.md
git commit -m "feat(backend): add refresh_tokens table for JWT logins"
```

---

### Task 2: Swap the session for JWT (issue, guard, errors, web and mobile)

**Files:**
- Create: `backend/app/blueprints/auth/tokens.py`, `backend/tests/test_tokens.py`
- Modify: `backend/app/extensions.py`, `backend/app/__init__.py`, `backend/app/blueprints/auth/routes.py`, `backend/app/blueprints/auth/guard.py`, `backend/tests/conftest.py`, `backend/tests/test_auth.py`, `backend/tests/test_guard.py`

**Interfaces:**
- Consumes: `RefreshToken` (Task 1); `User`, `validate_registration`, `validate_login`, `serialize_user`, the lockout in `login()` (already on the branch).
- Produces, in `tokens.py`:
  - `ACCESS_LIFETIME = timedelta(minutes=15)`, `REFRESH_LIFETIME = timedelta(days=30)`, `REFRESH_GRACE = timedelta(seconds=30)`.
  - `wants_mobile() -> bool`: true when `request.headers.get("X-Client") == "mobile"`.
  - `issue_tokens(user: User) -> tuple[str, str]`: creates an access and a refresh token (identity `str(user.id)`) and **adds** a `RefreshToken` row (its `jti` from `decode_token(refresh)["jti"]`, `expires_at = now + REFRESH_LIFETIME`) to the session. **The caller commits.**
  - `token_response(user: User, access: str, refresh: str, *, mobile: bool, status: int = 200) -> Response`:
    - mobile: `jsonify(user=..., access_token=..., refresh_token=...)`;
    - web: `jsonify(user=...)` plus `set_access_cookies(resp, access, max_age=int(REFRESH_LIFETIME.total_seconds()))` and `set_refresh_cookies(...)` with the same `max_age`.
  - `register_jwt_errors(jwt: JWTManager) -> None`: points every callback (`unauthorized_loader`, `invalid_token_loader`, `expired_token_loader`, `revoked_token_loader`, `needs_fresh_token_loader`, `token_verification_failed_loader`, `user_lookup_error_loader`) at `jsonify(error="Please log in."), 401`.
- `extensions.jwt: JWTManager`, initialised in `create_app`.
- After this task, `flask.session` is not used anywhere. `start_session` is deleted; `logout` only does `unset_jwt_cookies` + 204 (Task 3 adds revocation).
- conftest gains three helpers:
  - `csrf_headers(client, kind="access") -> dict` returns `{"X-CSRF-TOKEN": <value of the csrf_access_token or csrf_refresh_token cookie>}`, read with `client.get_cookie(...)`;
  - `mobile_register(client, email="ana@example.com")` is the register POST with `X-Client: mobile`;
  - `bearer(token) -> dict` returns `{"Authorization": f"Bearer {token}"}`.

  `make_household` sends `csrf_headers(client)`. The test code below shows `mobile_register` and `bearer` inline for readability; they live in conftest.

- [ ] **Step 1: Update existing tests and write new failing ones**

Changes to existing tests:
- `test_auth.py::test_session_cookie_flags` becomes `test_web_cookie_flags`. Collect `response.headers.getlist("Set-Cookie")` from register and assert:
  - the `access_token_cookie=` cookie has `HttpOnly`, `SameSite=Lax`, `Path=/api;`, `Max-Age=2592000`;
  - the `refresh_token_cookie=` cookie has `HttpOnly`, `Path=/api/auth`;
  - the `csrf_access_token=` cookie has **no** `HttpOnly` and has `Path=/`.
- `test_auth.py::test_cookie_secure_outside_debug` asserts `config["JWT_COOKIE_SECURE"] is True`.
- `test_auth.py::test_register_creates_user_and_logs_in` also asserts that the **web** body has no `access_token` key.
- `test_guard.py::test_session_for_deleted_user_is_401` becomes `test_token_for_deleted_user_is_401` (same assertions).
- `test_guard.py::test_cannot_write_to_others_household` sends `headers=csrf_headers(client)`.

New `tests/test_tokens.py`:

```python
def mobile_register(client, email="ana@example.com"):
    return client.post("/api/auth/register", headers={"X-Client": "mobile"},
                       json={"name": "Ana", "email": email, "password": "correct-horse"})

def bearer(token):
    return {"Authorization": f"Bearer {token}"}

def test_mobile_register_returns_tokens_and_no_cookies(client):
    r = mobile_register(client)
    body = r.get_json()
    assert r.status_code == 201 and set(body) == {"user", "access_token", "refresh_token"}
    assert r.headers.getlist("Set-Cookie") == []

def test_mobile_login_returns_tokens(client):
    mobile_register(client)
    r = client.post("/api/auth/login", headers={"X-Client": "mobile"},
                    json={"email": "ana@example.com", "password": "correct-horse"})
    assert r.status_code == 200 and "access_token" in r.get_json()

def test_mobile_bearer_needs_no_csrf(client):
    token = mobile_register(client).get_json()["access_token"]
    r = client.post("/api/households", headers=bearer(token),
                    json={"name": "Home", "electricity_rate": 12, "monthly_budget": 2000})
    assert r.status_code == 201

def test_web_write_without_csrf_is_401(client):
    register(client)
    r = client.post("/api/households", json={"name": "Home", "electricity_rate": 12, "monthly_budget": 2000})
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_web_write_with_csrf_works(client):
    register(client)
    r = client.post("/api/households", headers=csrf_headers(client),
                    json={"name": "Home", "electricity_rate": 12, "monthly_budget": 2000})
    assert r.status_code == 201

def test_refresh_token_cannot_be_used_as_access(client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    r = client.get("/api/households", headers=bearer(refresh))
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_expired_access_token_is_401(app, client):
    mobile_register(client)
    user = db.session.scalar(select(User))
    token = create_access_token(identity=str(user.id), expires_delta=timedelta(seconds=-1))
    r = client.get("/api/households", headers=bearer(token))
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_garbage_token_is_401(client):
    r = client.get("/api/households", headers=bearer("not.a.jwt"))
    assert r.status_code == 401 and r.get_json() == {"error": "Please log in."}

def test_access_token_has_no_personal_data(app, client):
    token = mobile_register(client).get_json()["access_token"]
    claims = decode_token(token)
    assert claims["sub"] == str(db.session.scalar(select(User)).id)
    assert "ana" not in json.dumps(claims).lower()

def test_register_records_refresh_row(app, client):
    mobile_register(client)
    row = db.session.scalar(select(RefreshToken))
    assert row.used_at is None
    assert timedelta(days=29, hours=23) < row.expires_at - datetime.now(timezone.utc) <= timedelta(days=30)
```

- [ ] **Step 2: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests -q`. Expected:
- the new token tests fail (no `X-Client` handling, no JWT);
- the changed cookie tests fail;
- the old login, guard and lockout tests are unaffected.

- [ ] **Step 3: Implement**

- `create_app`:
  - Remove the `SESSION_*` and `PERMANENT_SESSION_LIFETIME` config.
  - Set `SECRET_KEY`, `JWT_SECRET_KEY=secret_key`, and the cookie, path, CSRF and lifetime settings from Global Constraints. Use `JWT_ACCESS_TOKEN_EXPIRES=ACCESS_LIFETIME`, `JWT_REFRESH_TOKEN_EXPIRES=REFRESH_LIFETIME`, and `JWT_COOKIE_SECURE=os.getenv("FLASK_DEBUG") != "1"`. All of this goes **before** `app.config.update(test_config)`.
  - Call `jwt.init_app(app)` and `register_jwt_errors(jwt)`.
- `routes.py`:
  - `register` and `login` end with `access, refresh = issue_tokens(user)`, a commit, then `token_response(user, access, refresh, mobile=wants_mobile(), status=201 or 200)`.
  - `login` commits the lockout reset in the same commit as the new row.
  - `logout`: `unset_jwt_cookies` on a 204.
- `guard.py`: replace the session lookup with `verify_jwt_in_request()` followed by `db.session.get(User, int(get_jwt_identity()))`. Let JWT exceptions propagate (the registered handlers answer 401). A missing user still returns the 401 JSON. Add `auth.refresh` to `PUBLIC_ENDPOINTS`; the household ownership step is unchanged.

- [ ] **Step 4: Run and confirm pass**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass, and `grep -rn "session\[" backend/app` finds nothing.

- [ ] **Step 5: Commit**

```powershell
git add backend/app backend/tests
git commit -m "feat(backend): switch login to JWT for web cookies and mobile bearer tokens"
```

---

### Task 3: Refresh with rotation, real logout, cleanup, docs

**Files:**
- Modify: `backend/app/blueprints/auth/routes.py`, `backend/app/blueprints/auth/tokens.py`, `backend/README.md`
- Create: `backend/tests/test_refresh.py`

**Interfaces:**
- Consumes: `issue_tokens`, `token_response`, `REFRESH_GRACE`, `REFRESH_LIFETIME`, and `csrf_headers` (Task 2); `RefreshToken` (Task 1).
- Produces: `POST /api/auth/refresh` (`auth.refresh`); logout that revokes; `tokens.prune_refresh_tokens(user_id: int) -> None`, called from `login` before issuing.

- [ ] **Step 1: Write failing tests in `tests/test_refresh.py`**

```python
def web_refresh(client):
    return client.post("/api/auth/refresh", headers=csrf_headers(client, "refresh"))

def test_web_refresh_rotates(app, client):
    register(client)
    r = web_refresh(client)
    assert r.status_code == 200 and set(r.get_json()) == {"user"}
    assert any(c.startswith("access_token_cookie=") for c in r.headers.getlist("Set-Cookie"))
    rows = db.session.scalars(select(RefreshToken).order_by(RefreshToken.id)).all()
    assert len(rows) == 2 and rows[0].used_at is not None and rows[1].used_at is None

def test_mobile_refresh_returns_json(client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    r = client.post("/api/auth/refresh", headers=bearer(refresh))
    assert r.status_code == 200 and set(r.get_json()) == {"user", "access_token", "refresh_token"}
    assert r.headers.getlist("Set-Cookie") == []

def test_cookie_refresh_ignores_mobile_header(client):
    register(client)
    r = client.post("/api/auth/refresh", headers={**csrf_headers(client, "refresh"), "X-Client": "mobile"})
    assert r.status_code == 200 and set(r.get_json()) == {"user"}

def test_refresh_without_token_or_with_access_token_is_401(client):
    assert client.post("/api/auth/refresh").status_code == 401
    access = mobile_register(client).get_json()["access_token"]
    assert client.post("/api/auth/refresh", headers=bearer(access)).status_code == 401

def test_web_refresh_without_csrf_is_401(client):
    register(client)
    assert client.post("/api/auth/refresh").status_code == 401

def test_reuse_within_grace_is_409_and_revokes_nothing(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    new = client.post("/api/auth/refresh", headers=bearer(refresh)).get_json()["refresh_token"]
    r = client.post("/api/auth/refresh", headers=bearer(refresh))
    assert r.status_code == 409 and r.get_json() == {"error": "Refresh already used."}
    assert client.post("/api/auth/refresh", headers=bearer(new)).status_code == 200

def test_reuse_after_grace_revokes_all(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    other = client.post("/api/auth/login", headers={"X-Client": "mobile"},
                        json={"email": "ana@example.com", "password": "correct-horse"}).get_json()["refresh_token"]
    client.post("/api/auth/refresh", headers=bearer(refresh))
    db.session.execute(update(RefreshToken).where(RefreshToken.used_at.is_not(None))
                       .values(used_at=datetime.now(timezone.utc) - timedelta(seconds=31)))
    db.session.commit()
    r = client.post("/api/auth/refresh", headers=bearer(refresh))
    assert r.status_code == 401
    assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 0
    assert client.post("/api/auth/refresh", headers=bearer(other)).status_code == 401

def test_refresh_after_user_deleted_is_401(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    db.session.execute(delete(User)); db.session.commit()
    assert client.post("/api/auth/refresh", headers=bearer(refresh)).status_code == 401

def test_refresh_slides_expiry(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    db.session.execute(update(RefreshToken).values(expires_at=datetime.now(timezone.utc) + timedelta(days=1)))
    db.session.commit()
    client.post("/api/auth/refresh", headers=bearer(refresh))
    newest = db.session.scalar(select(RefreshToken).where(RefreshToken.used_at.is_(None)))
    assert newest.expires_at - datetime.now(timezone.utc) > timedelta(days=29)

def test_mobile_logout_revokes(app, client):
    refresh = mobile_register(client).get_json()["refresh_token"]
    assert client.post("/api/auth/logout", headers=bearer(refresh)).status_code == 204
    assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 0
    assert client.post("/api/auth/refresh", headers=bearer(refresh)).status_code == 401

def test_web_logout_revokes_and_clears_cookies(app, client):
    register(client)
    r = client.post("/api/auth/logout", headers=csrf_headers(client, "refresh"))
    assert r.status_code == 204
    assert db.session.scalar(select(func.count()).select_from(RefreshToken)) == 0
    assert client.get("/api/auth/me").status_code == 401

def test_logout_never_fails(client):
    assert client.post("/api/auth/logout", headers=bearer("garbage")).status_code == 204
    register(client)
    assert client.post("/api/auth/logout").status_code == 204   # cookie but no CSRF header

def test_login_prunes_old_rows(app, client):
    mobile_register(client)
    user = db.session.scalar(select(User))
    now = datetime.now(timezone.utc)
    db.session.add_all([
        RefreshToken(user_id=user.id, jti="expired", expires_at=now - timedelta(seconds=1)),
        RefreshToken(user_id=user.id, jti="old-used", expires_at=now + timedelta(days=5),
                     used_at=now - timedelta(days=2)),
    ])
    db.session.commit()
    client.post("/api/auth/login", headers={"X-Client": "mobile"},
                json={"email": "ana@example.com", "password": "correct-horse"})
    jtis = set(db.session.scalars(select(RefreshToken.jti)))
    assert "expired" not in jtis and "old-used" not in jtis and len(jtis) == 2
```

(`mobile_register`, `bearer` and `csrf_headers` come from `conftest.py`, Task 2.)

- [ ] **Step 2: Run and confirm failure**

Run: `venv\Scripts\python -m pytest tests/test_refresh.py -q` → Expected: failures (no `/refresh` route; logout doesn't revoke; no pruning).

- [ ] **Step 3: Implement**

`refresh()`:
1. Call `verify_jwt_in_request(refresh=True)`; errors become 401 through the handlers.
2. Take `get_jwt()["jti"]` and load the row with `with_for_update()`.
3. Branch on the row:
   - missing → 401;
   - `used_at` within `REFRESH_GRACE` → 409 `"Refresh already used."`;
   - `used_at` older than the grace → delete every row for that `user_id`, commit, 401;
   - otherwise → load the user (if missing → 401), set `used_at = now`, `issue_tokens(user)`, commit, then `token_response(..., mobile=get_jwt_request_location() == "headers")`.

`logout()`:
- In `try`, run `verify_jwt_in_request(refresh=True, optional=True)`. If a token was read, delete its row by `jti` and commit.
- Catch `flask_jwt_extended.exceptions.JWTExtendedException` and `jwt.exceptions.PyJWTError` and ignore them.
- Always end with `unset_jwt_cookies` and 204.

`prune_refresh_tokens(user_id)`: delete that user's rows where `expires_at < now` or `used_at < now - timedelta(days=1)`. Call it in `login` on the success path.

`README.md`: rewrite the "Auth API" section per the spec's "Config and docs":
- the endpoint table, now with `/refresh`;
- web (cookies + `X-CSRF-TOKEN` from the `csrf_access_token` / `csrf_refresh_token` cookies) versus mobile (`X-Client: mobile`, then Bearer);
- lifetimes and the sliding 30 days;
- the client rule (401 → refresh → retry; refresh 401 → login; refresh 409 → web retries once, mobile logs in);
- the password-reset reminder.

Keep the ownership, legacy households, `SECRET_KEY` and Tests paragraphs.

- [ ] **Step 4: Run the whole suite**

Run: `venv\Scripts\python -m pytest tests -q` → Expected: all pass.

- [ ] **Step 5: Manual check on a throwaway server (port 5001, the `energywise_migrate` DB; stop it by its own task id, never by process name)**

Using `curl.exe`:
- Mobile:
  - register with `X-Client: mobile` → 201 with tokens;
  - `GET /api/households` with Bearer → 200;
  - refresh with Bearer → 200 with new tokens;
  - reuse the old refresh token immediately → 409;
  - logout with the new refresh token → 204;
  - refresh with it → 401.
- Web: with a cookie jar, register → 201 and cookies set; `POST /api/households` without `X-CSRF-TOKEN` → 401; the same call with it → 201.

- [ ] **Step 6: Commit**

```powershell
git add backend/app backend/tests backend/README.md
git commit -m "feat(backend): add rotating refresh tokens and real logout"
```

PR notes (Summary / Testing / Notes):
- deploy together with the web login PR;
- set `SECRET_KEY` in Render if the service isn't Blueprint-managed;
- teammates' `.env` needs `SECRET_KEY`;
- the schema owner should review migration `f4b2d8c61a37`;
- the mobile team stores tokens in Keychain/Keystore and sends `X-Client: mobile` on login and register.
