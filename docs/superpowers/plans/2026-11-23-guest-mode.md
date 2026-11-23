# Guest Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make login optional. Every visitor gets a private guest account from `POST /api/auth/guest`. Registering upgrades that guest in place, logging in pulls the guest's households into the account, and abandoned guests are cleaned up.

**Architecture:** A guest is a `users` row with `email` NULL, so tokens, refresh, logout and the ownership guard work unchanged. One helper, `recognise_guest()`, finds the guest behind a register or login request. It decodes the access token itself and allows an expired one, so idle guests keep their data. A cleanup helper runs on each `/guest` call.

**Tech Stack:** Flask 3.1, flask-jwt-extended 4.7.4, SQLAlchemy 2, Alembic, Postgres (a throwaway local cluster for tests), pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-login-register-backend-design.md`, the "Guest mode" section (the rest of that spec is already built).

**Starting point:** branch `feat/login-register-back` at `9444df1` (pushed; 72 tests pass). Files involved: `app/models/user.py`, `app/blueprints/auth/{routes,tokens}.py`, migration `f4b2d8c61a37`, `tests/`.

## Global Constraints

- Migration `f4b2d8c61a37` is **edited in place** (never applied to a shared database) and still only **adds** relative to `main`.
- Guests: `users.email`, `name` and `password_hash` are NULL. A check constraint, `ck_users_guest_consistent`, enforces `(email IS NULL) = (password_hash IS NULL)`. `User.is_guest` is `email is None`.
- User JSON is exactly `{"id", "name", "email", "is_guest"}`; for guests, `name` and `email` are `null`.
- `POST /api/auth/guest`: public, ignores the body and any existing token, returns **201** with tokens (cookies, or JSON when `X-Client: mobile`).
- Register **upgrading** a guest returns **200**. Register creating a new user returns **201**. A duplicate email returns **409** `"An account with this email already exists."`, and the guest stays a guest.
- Recognising a guest:
  - the `access_token_cookie` cookie counts only together with an `X-CSRF-TOKEN` header, checked against it;
  - otherwise the `Authorization: Bearer` header;
  - the token is decoded with `allow_expired=True` and must have `type == "access"`;
  - any failure means "no guest"; register and login **never return 401 because of it**.
- Reply carrier when a guest was recognised: from a cookie → cookies (ignore `X-Client`); from a header → JSON. With no guest → `wants_mobile()` as today.
- Cleanup: a guest is abandoned when it has no `refresh_tokens` row with `expires_at > now AND used_at IS NULL`. Each `/guest` call deletes up to **50**, oldest `created_at` first. Never touch rows with `email IS NOT NULL`. Appliances have **no** DB cascade, so delete them explicitly.
- Refresh also calls `prune_refresh_tokens(user_id)`.
- Tests only use a localhost DB. Never Supabase, never port 5000.
- Commit messages: `feat(backend): ...`, **no AI attribution lines**.

## Review Focus

1. **Idle guest signs up:** with an expired (but genuine) guest access token, register must upgrade that guest and keep its households. (Task 3)
2. **Cookie guest without a CSRF header:** not recognised. Register creates a new user and the guest is untouched. (Task 3)
3. **Cleanup safety:** it never deletes real users or guests with a usable refresh token, and it removes an abandoned guest's appliances (no DB cascade) without an IntegrityError. (Task 2)
4. **Upgrade to a taken email:** 409, and the guest is still a guest with its data and a working session. (Task 3)
5. **Login with a token that isn't a guest's** (a real user's, or the same account's): nothing moves and nobody is deleted. (Task 3)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `backend/app/models/user.py` (modify) | nullable columns, check constraint, `is_guest` |
| `backend/migrations/versions/f4b2d8c61a37_add_users_and_household_owner.py` (modify in place) | same changes in the DB |
| `backend/app/blueprints/auth/tokens.py` (modify) | `serialize_user` adds `is_guest` |
| `backend/app/blueprints/auth/guests.py` (create) | `create_guest`, `delete_abandoned_guests`, `recognise_guest`, `merge_guest_into` |
| `backend/app/blueprints/auth/routes.py` (modify) | `/guest`; register and login guest paths; refresh prunes |
| `backend/app/blueprints/auth/guard.py` (modify) | `auth.guest` becomes public |
| `backend/README.md` (modify) | guest mode in the Auth API section |
| `backend/tests/test_models.py`, `test_auth.py` (modify), `test_guest.py`, `test_guest_upgrade.py` (create) | tests |

---

### Task 1: Guest-capable users

**Files:** Modify `app/models/user.py`, the migration, `app/blueprints/auth/tokens.py`, `tests/test_models.py`, `tests/test_auth.py`

**Interfaces:**
- Produces: `User.name/email/password_hash: str | None` (nullable); the table arg `db.CheckConstraint("(email IS NULL) = (password_hash IS NULL)", name="ck_users_guest_consistent")`; the property `User.is_guest -> bool`; `serialize_user(user) -> {"id", "name", "email", "is_guest"}`.

- [ ] **Step 1: Start the throwaway DB if it isn't running**

  Same as the last plan: an `initdb` cluster in the scratchpad on port 5433, **started from PowerShell**, with databases `energywise_test` and `energywise_migrate`. Set `TEST_DATABASE_URL=postgresql://postgres@localhost:5433/energywise_test`.

- [ ] **Step 2: Write failing tests**

  In `test_models.py`:

  ```python
  def test_guest_user_allows_nulls_and_many_guests(app):
      db.session.add_all([User(), User()])
      db.session.commit()
      assert all(u.is_guest for u in db.session.scalars(select(User)))

  def test_email_without_password_rejected(app):
      db.session.add(User(name="A", email="a@example.com"))
      with pytest.raises(IntegrityError):
          db.session.commit()
      db.session.rollback()

  def test_real_user_is_not_guest(app):
      user = User(name="A", email="a@example.com", password_hash="x")
      db.session.add(user)
      db.session.commit()
      assert user.is_guest is False
  ```

  In `test_auth.py`, `test_register_creates_user_and_logs_in` now expects `{"user": {"id": ANY, "name": "Ana", "email": "ana@example.com", "is_guest": False}}`.

- [ ] **Step 3: Run and confirm failure**

  Run: `venv\Scripts\python -m pytest tests -q`. Expected: the new model tests fail (NOT NULL violation / no `is_guest`), and so does the register test.

- [ ] **Step 4: Implement the model, `serialize_user`, and the migration edit**

  In the `users` `create_table`, `name`, `email` and `password_hash` become `nullable=True`. Add `sa.CheckConstraint("(email IS NULL) = (password_hash IS NULL)", name="ck_users_guest_consistent")`.

- [ ] **Step 5: Run and confirm pass**

  Run: `venv\Scripts\python -m pytest tests -q`. Expected: all pass.

- [ ] **Step 6: Verify the migration on `energywise_migrate` only**

  Run `db upgrade`, then `db downgrade e3a1c5d7f902`, then `db upgrade`; each must exit 0. Then insert a test guest:

  ```
  psql ... -c "insert into users (created_at, failed_login_count) values (now(), 0)"
  ```

  It succeeds.

- [ ] **Step 7: Commit**

  `git commit -m "feat(backend): allow guest users with no email or password"` (also add this plan file and the spec).

---

### Task 2: `/guest` endpoint and cleanup

**Files:** Create `app/blueprints/auth/guests.py` and `tests/test_guest.py`. Modify `routes.py` and `guard.py`.

**Interfaces:**
- Consumes: `issue_tokens`, `token_response`, `wants_mobile`, `prune_refresh_tokens` (`tokens.py`).
- Produces (in `guests.py`):
  - `GUEST_CLEANUP_BATCH = 50`;
  - `create_guest() -> User`: adds and flushes a guest; the caller commits;
  - `delete_abandoned_guests(limit: int = GUEST_CLEANUP_BATCH) -> int`: deletes, in order, appliances of their households, then the households, then the users; returns the number of users deleted; the caller commits.
- `POST /api/auth/guest` (`auth.guest`) calls `delete_abandoned_guests()`, then `create_guest()`, then `issue_tokens`, commits, and returns `token_response(..., mobile=wants_mobile(), status=201)`.
- `refresh()` calls `prune_refresh_tokens(user.id)` before issuing.

- [ ] **Step 1: Write failing tests in `tests/test_guest.py`**

  ```python
  def start_guest(client, mobile=False):
      return client.post("/api/auth/guest", headers={"X-Client": "mobile"} if mobile else {})

  def test_web_guest_gets_cookies(client):
      r = start_guest(client)
      assert r.status_code == 201
      assert r.get_json() == {"user": {"id": ANY, "name": None, "email": None, "is_guest": True}}
      assert client.get("/api/auth/me").get_json()["user"]["is_guest"] is True

  def test_mobile_guest_gets_tokens(client):
      body = start_guest(client, mobile=True).get_json()
      assert set(body) == {"user", "access_token", "refresh_token"}

  def test_guest_can_use_features_privately(client):
      start_guest(client)
      home = make_household(client)
      assert client.get(f"/api/households/{home}/appliances").status_code == 200
      other = app_client_for_new_guest(client)  # a second test_client()
      assert other.get(f"/api/households/{home}/appliances").status_code == 404

  def test_cleanup_deletes_abandoned_guest_with_appliances(app, client):
      token = start_guest(client, mobile=True).get_json()["access_token"]
      home = client.post("/api/households", headers=bearer(token), json=HOME).get_json()["item"]["id"]
      client.post(f"/api/households/{home}/appliances", headers=bearer(token),
                  json={"name": "Fan", "watts": 50, "hours_per_day": 4})
      db.session.execute(delete(RefreshToken)); db.session.commit()   # abandoned
      start_guest(client)
      assert db.session.get(Household, home) is None
      assert db.session.scalar(select(func.count()).select_from(Appliance)) == 0

  def test_cleanup_keeps_real_users_and_active_guests(app, client):
      register(client); client.post("/api/auth/logout")             # real user, no refresh rows left
      start_guest(client, mobile=True)                              # active guest
      start_guest(client)
      emails = [u.email for u in db.session.scalars(select(User))]
      assert "ana@example.com" in emails
      assert sum(e is None for e in emails) == 2

  def test_cleanup_counts_used_rows_as_dead(app, client):
      start_guest(client, mobile=True)
      db.session.execute(update(RefreshToken).values(used_at=datetime.now(timezone.utc)))
      db.session.commit()
      start_guest(client)
      assert db.session.scalar(select(func.count()).select_from(User)) == 1

  def test_cleanup_batch_is_capped(app, client):
      db.session.add_all([User() for _ in range(60)]); db.session.commit()
      start_guest(client)
      assert db.session.scalar(select(func.count()).select_from(User)) == 11   # 60 - 50 + new one

  def test_refresh_prunes_old_used_rows(app, client):
      refresh = start_guest(client, mobile=True).get_json()["refresh_token"]
      user = db.session.scalar(select(User))
      db.session.add(RefreshToken(user_id=user.id, jti="old-used",
                                  expires_at=datetime.now(timezone.utc) + timedelta(days=5),
                                  used_at=datetime.now(timezone.utc) - timedelta(days=2)))
      db.session.commit()
      client.post("/api/auth/refresh", headers=bearer(refresh))
      assert "old-used" not in set(db.session.scalars(select(RefreshToken.jti)))
  ```

  (`HOME`, `bearer`, `make_household` and `register` come from `conftest.py`; move `HOME` there. `app_client_for_new_guest(client)` is a small local helper: `c = client.application.test_client(); start_guest(c); return c`.)

- [ ] **Step 2: Run and confirm failure**

  Run: `venv\Scripts\python -m pytest tests/test_guest.py -q`. Expected: failures; `/guest` is 401 because it isn't public yet.

- [ ] **Step 3: Implement**

  - Write `guests.py` as described in Interfaces.
  - The abandoned-guest query: `select(User.id).where(User.email.is_(None), ~exists().where(RefreshToken.user_id == User.id, RefreshToken.expires_at > now, RefreshToken.used_at.is_(None))).order_by(User.created_at).limit(limit)`.
  - Add `auth.guest` to `PUBLIC_ENDPOINTS`.
  - Add the `/guest` route and the prune call in `refresh()`.

- [ ] **Step 4: Run and confirm pass**

  Run: `venv\Scripts\python -m pytest tests -q`. Expected: all pass.

- [ ] **Step 5: Commit**

  `git commit -m "feat(backend): add guest sessions with automatic cleanup"`

---

### Task 3: Register upgrades guests, login merges them, README

**Files:** Modify `guests.py`, `routes.py`, `backend/README.md`. Create `tests/test_guest_upgrade.py`.

**Interfaces:**
- Consumes: `create_guest`, `issue_tokens`, `token_response`, `wants_mobile`.
- Produces (in `guests.py`):
  - `recognise_guest() -> tuple[User | None, str | None]` returns `(guest, "cookies" | "headers")` or `(None, None)`:
    - **cookie path:** read the `access_token_cookie` cookie; if present, require a non-empty `X-CSRF-TOKEN` header and call `decode_token(cookie, csrf_value=header, allow_expired=True)`. Without the header, return none; `decode_token` skips the CSRF check when `csrf_value` is empty, so don't call it without one.
    - **header path:** otherwise, a `Bearer` value from `Authorization`, decoded with `allow_expired=True`.
    - **checks:** require `claims["type"] == "access"`; load `User` by `int(claims["sub"])` and require `is_guest`.
    - **errors:** catch `JWTExtendedException`, `PyJWTError`, `ValueError` and `KeyError`; any of them means none.
  - `merge_guest_into(guest: User, account: User) -> None`: runs `UPDATE households SET user_id = account.id WHERE user_id = guest.id`, then deletes the guest. Doesn't commit.
- `register()`:
  1. Validate, then hash the password.
  2. Call `guest, where = recognise_guest()`.
  3. **If a guest was found:** set name, email and password hash on it, then delete its refresh rows. On `IntegrityError`, roll back and return 409. Otherwise issue tokens, commit, and return status **200** with `mobile=(where == "headers")`.
  4. **Otherwise:** behave as today (201, `mobile=wants_mobile()`).
- `login()`: on the success path only, after the lockout reset:
  1. Call `guest, where = recognise_guest()`.
  2. If a guest was found and `guest.id != user.id`, call `merge_guest_into(guest, user)`.
  3. Choose the reply carrier: `where == "headers"` if a guest was found, else `wants_mobile()`.
  4. Prune, issue tokens, commit (the merge is in the same commit).

- [ ] **Step 1: Write failing tests in `tests/test_guest_upgrade.py`**

  ```python
  def guest_with_home(client, mobile=False):
      r = start_guest(client, mobile=mobile)
      headers = bearer(r.get_json()["access_token"]) if mobile else csrf_headers(client)
      home = client.post("/api/households", headers=headers, json=HOME).get_json()["item"]["id"]
      return r, home

  def test_register_upgrades_web_guest_in_place(app, client):
      r, home = guest_with_home(client)
      guest_id = r.get_json()["user"]["id"]
      up = client.post("/api/auth/register", headers=csrf_headers(client), json=NEW_USER)
      assert up.status_code == 200
      assert up.get_json()["user"] == {"id": guest_id, "name": "Ana", "email": "ana@example.com", "is_guest": False}
      assert db.session.get(Household, home).user_id == guest_id

  def test_register_upgrades_idle_guest_with_expired_token(app, client):
      r, home = guest_with_home(client, mobile=True)
      guest_id = r.get_json()["user"]["id"]
      expired = create_access_token(identity=str(guest_id), expires_delta=timedelta(seconds=-1))
      up = client.post("/api/auth/register", headers=bearer(expired), json=NEW_USER)
      assert up.status_code == 200 and up.get_json()["user"]["id"] == guest_id

  def test_upgrade_revokes_old_guest_refresh(client):
      body = start_guest(client, mobile=True).get_json()
      client.post("/api/auth/register", headers=bearer(body["access_token"]), json=NEW_USER)
      assert client.post("/api/auth/refresh", headers=bearer(body["refresh_token"])).status_code == 401

  def test_cookie_guest_upgrade_ignores_mobile_header(client):
      guest_with_home(client)
      up = client.post("/api/auth/register", headers={**csrf_headers(client), "X-Client": "mobile"}, json=NEW_USER)
      assert up.status_code == 200 and set(up.get_json()) == {"user"}

  def test_cookie_guest_without_csrf_not_recognised(app, client):
      r, home = guest_with_home(client)
      up = client.post("/api/auth/register", json=NEW_USER)
      assert up.status_code == 201 and up.get_json()["user"]["id"] != r.get_json()["user"]["id"]
      assert db.session.get(User, r.get_json()["user"]["id"]).is_guest

  def test_upgrade_to_taken_email_keeps_guest(app, client):
      register(client); client.post("/api/auth/logout")
      r, home = guest_with_home(client)
      up = client.post("/api/auth/register", headers=csrf_headers(client), json=NEW_USER)
      assert up.status_code == 409
      assert db.session.get(User, r.get_json()["user"]["id"]).is_guest
      assert client.get(f"/api/households/{home}/appliances").status_code == 200

  def test_register_with_real_user_token_creates_new_user(client):
      access = mobile_register(client).get_json()["access_token"]
      r = client.post("/api/auth/register", headers=bearer(access), json={**NEW_USER, "email": "ben@example.com"})
      assert r.status_code == 201

  def test_login_merges_guest_households(app, client):
      register(client); client.post("/api/auth/logout")
      r, home = guest_with_home(client)
      login = client.post("/api/auth/login", headers=csrf_headers(client), json=LOGIN)
      account_id = login.get_json()["user"]["id"]
      assert db.session.get(Household, home).user_id == account_id
      assert db.session.get(User, r.get_json()["user"]["id"]) is None

  def test_failed_login_moves_nothing(app, client):
      register(client); client.post("/api/auth/logout")
      r, home = guest_with_home(client)
      client.post("/api/auth/login", headers=csrf_headers(client), json={**LOGIN, "password": "wrong-pass"})
      assert db.session.get(Household, home).user_id == r.get_json()["user"]["id"]

  def test_login_with_real_user_token_moves_nothing(app, client):
      access = mobile_register(client).get_json()["access_token"]
      home = client.post("/api/households", headers=bearer(access), json=HOME).get_json()["item"]["id"]
      client.post("/api/auth/login", headers=bearer(access), json=LOGIN)
      assert db.session.scalar(select(func.count()).select_from(User)) == 1
      assert db.session.get(Household, home) is not None
  ```

  (`NEW_USER = {"name": "Ana", "email": "ana@example.com", "password": "correct-horse"}` and `LOGIN` go in `conftest.py`, alongside `start_guest`, which moves there from `test_guest.py`.)

- [ ] **Step 2: Run and confirm failure**

  Run: `venv\Scripts\python -m pytest tests/test_guest_upgrade.py -q`. Expected: failures, because register still creates new users and login doesn't merge.

- [ ] **Step 3: Implement** `recognise_guest`, `merge_guest_into`, and the register and login changes as described in Interfaces.

- [ ] **Step 4: Update `backend/README.md` → Auth API**

  - Add `POST /guest` to the table.
  - Add a "Guest mode" paragraph covering:
    - what a guest is;
    - `/guest` on first visit and after logout;
    - register upgrades the guest (200) and keeps its data;
    - login pulls guest households in;
    - an expired guest token still counts on register and login;
    - abandoned-guest cleanup;
    - a guest who logs out loses their data, so the UI hides Log out for guests and shows "Create an account to keep your data".
  - The user object gains `is_guest`.

- [ ] **Step 5: Run the whole suite**

  Run: `venv\Scripts\python -m pytest tests -q`. Expected: all pass.

- [ ] **Step 6: Manual check (port 5001, `energywise_migrate`; stop it by its task id)**

  Using `curl`:
  - `/guest` with `X-Client: mobile` → 201;
  - create a household with Bearer;
  - register with that Bearer → 200, same id;
  - `GET /households` with the new token lists the household.

  Then, with a web cookie jar:
  - `/guest` → 201;
  - register with `X-CSRF-TOKEN` → 200.

- [ ] **Step 7: Commit**

  `git commit -m "feat(backend): upgrade guests on register and merge them on login"`
