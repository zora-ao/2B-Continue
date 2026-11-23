# Login & Register (backend) — Design

**Date:** 2026-11-23
**Project:** EnergyWise — SDG 7 energy-saving web app
**Scope:** Backend only (`backend/`). The login and register pages are a separate, later frontend PR.
**Branch:** `feat/login-register-back`

## Why

Today the API has no idea who is using it. `GET /api/households` returns every household, and every other endpoint works off the household id in the URL, so anyone who can reach the API can read or change anyone's bills, readings, solar setup, and alerts. We want EnergyWise to be private per user: a person registers, logs in, lands on the dashboard, and from then on sees and changes only their own households.

## Goals

- Register with **name, email, password**; log in with **email + password**; log out; ask "who am I".
- Every `/api` endpoint except register, login, logout, and health requires a logged-in user.
- A user can only reach households they own (and everything under them: appliances, budget plans, dashboard, readings, solar, alerts).
- `GET /api/households` lists only the user's households; `POST /api/households` makes the new one theirs.
- Reasonable security for a small Flask app (see Security).

## Non-goals (this PR)

- Login / register pages, route guards, or any other frontend change (next PR).
- Forgot / reset password (later PR; needs an email service). Until then a forgotten password is reset by hand in Supabase.
- Email verification, two-factor login, CAPTCHA.
- Sharing a household between several users, roles, or admin accounts.
- Editing a profile, changing a password, or deleting an account.
- Claiming households that existed before this change.

## Anti-goals

- **Changing or deleting existing Supabase data or tables.** A teammate owns the schema. The migration may only add things.
- Ownership checks scattered across the other teammates' blueprints, where one missed route silently leaks data.
- Storing passwords in plain text, or a session token that page JavaScript can read.

## Constraints

- Flask + Flask-SQLAlchemy + Alembic (Flask-Migrate) on Supabase Postgres; deployed on Render (`render.yaml` runs `flask db upgrade` on start). Frontend on Vercel rewrites `/api/*` to Render; locally Vite proxies `/api` to Flask. The browser therefore always talks to a single origin.
- No new Python dependencies are needed (Werkzeug's password hashing and Flask's built-in session are enough).
- Never test against the real backend on port 5000 / live Supabase (`CLAUDE.md`).
- Follow the existing style: models in `app/models/`, one blueprint per feature in `app/blueprints/<name>/`, errors as `{"error": "..."}` via `app/errors.py`, `json_payload()` for request bodies.

## Approaches considered

**How ownership is enforced on existing endpoints**

1. **One central check — chosen.** An app-wide `before_request` hook requires a logged-in user on every `/api` request (except the public endpoints) and, when the matched URL has a `household_id`, checks that the household belongs to that user. Every current route is covered without editing it, and future blueprints mounted under `/api/households/<int:household_id>/...` are covered automatically. Cost: one small extra query per request.
2. Add an owner filter to each blueprint's household lookup (`household_record`, `get_household`, `db.get_or_404`, …). Touches about six teammate-owned files, and routes that never look up the household must be found by hand; a miss leaks silently.
3. Flask-Login plus a decorator on each route. Common library, but a new dependency, and like (2) it relies on remembering the decorator on every route forever.

**What happens to households created before login existed**

1. **Leave them unowned (`user_id` NULL) — chosen.** They become invisible to everyone but are not deleted; one SQL `UPDATE` in Supabase can hand one to a real account later. The migration only adds.
2. Make `user_id` required. Would force filling in or deleting existing rows during migration.
3. Give all existing households to the first account that registers. Surprising, and whoever registers first (maybe a test account) gets everyone's data.

## Decided

### Database (one new migration, `down_revision = "e3a1c5d7f902"`)

New table `users`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | |
| `name` | varchar(120), not null | trimmed, 1–120 chars |
| `email` | varchar(254), not null, unique | stored trimmed + lowercased, so uniqueness ignores case |
| `password_hash` | varchar(255), not null | Werkzeug `generate_password_hash` (scrypt default) |
| `failed_login_count` | integer, not null, default 0 | for lockout |
| `locked_until` | timestamptz, nullable | for lockout |
| `created_at` | timestamptz, not null | UTC, like other tables |

`households` gets one new column: `user_id` integer, **nullable**, FK → `users.id`, indexed. Nothing else on existing tables changes. Downgrade drops the column and the table.

The migration also runs `ALTER TABLE users ENABLE ROW LEVEL SECURITY` with **no policies** (downgrade disables it). *(Builder's call, from review.)* Supabase exposes `public` tables through its REST Data API, and a table created by Alembic has RLS off, so anyone holding the project's anon key could otherwise read emails and password hashes. Flask connects as the `postgres` role, which bypasses RLS, so the app is unaffected. This only adds something, and it's safe whether or not the Data API is in use.

New model `app/models/user.py` (`User`), exported from `app/models/__init__.py`; `Household` gets the `user_id` column.

### Endpoints — new blueprint `auth`, mounted at `/api/auth`

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/register` | `{name, email, password}` | 201 `{"user": {...}}`, and the user is logged in | 400 invalid input; 409 `"An account with this email already exists."` |
| POST | `/login` | `{email, password}` | 200 `{"user": {...}}` | 400 invalid input; 401 `"Email or password is incorrect."`; 429 locked |
| POST | `/logout` | none | 204 | — |
| GET | `/me` | — | 200 `{"user": {...}}` | 401 not logged in |

The user object is `{"id", "name", "email"}`, never the hash or lockout fields.

Validation: only the listed keys are accepted (same style as `create_household`); name 1–120 chars after trimming; email trimmed, lowercased, ≤254 chars, contains a single `@` with text on both sides and a dot in the domain (no stricter check); password 8–128 characters, no other rules.

### Session

- Flask's built-in signed-cookie session stores `user_id`. `session.clear()` on register, login, and logout; `session.permanent = True` on login/register.
- Cookie: `HttpOnly` (Flask default), `SameSite=Lax`, `Secure` when `FLASK_DEBUG` is not `"1"`, lifetime 7 days (`PERMANENT_SESSION_LIFETIME`).
- `SECRET_KEY` comes from the environment. `create_app` raises at startup if it is missing (same pattern as `DATABASE_URL`). Add it to `backend/.env.example` and to `render.yaml` with `generateValue: true` so Render creates a strong random value.

### The central check (`before_request`, registered in `create_app`)

For each request whose path starts with `/api`:

1. Skip `OPTIONS` (CORS preflight) and the public endpoints: `auth.register`, `auth.login`, `auth.logout`, `api.health`.
2. Load the user from `session["user_id"]`. If there is none, or the user no longer exists, clear the session and return **401** `{"error": "Please log in."}`.
3. Put the user on `flask.g.user`.
4. If `request.view_args` contains `household_id`, check that a household with that id and `user_id == g.user.id` exists; otherwise return **404** with the existing "Requested resource not found." message (404, not 403, so ids can't be probed).

### Households routes (the only existing routes edited)

- `GET /api/households` filters by `Household.user_id == g.user.id`.
- `POST /api/households` sets `user_id = g.user.id`.

### Security

- Passwords hashed with Werkzeug scrypt; 128-char cap stops slow-hash abuse.
- Same 401 message for unknown email and wrong password. For an unknown email, still run `check_password_hash` against a fixed dummy hash so response time doesn't reveal whether the account exists.
- Lockout: each failed login on an existing account increments `failed_login_count`; on the 5th, set `locked_until = now + 15 min` and reset the count. While `locked_until` is in the future, login returns **429** `"Too many failed attempts. Try again in 15 minutes."` without checking the password. A successful login resets the count and clears `locked_until`. (Accepted trade-off: someone can lock another user out for 15 minutes.)
- CSRF: `SameSite=Lax` plus the existing JSON-only request bodies (`json_payload` requires `application/json`, which other sites can't send without a CORS preflight). No CSRF tokens. CORS stays limited to `CORS_ORIGINS`; `supports_credentials` is not needed because the browser calls the API same-origin through the Vite/Vercel proxies.
- Passwords never appear in logs or error messages.
- Accepted leaks: register says when an email is taken (409), and the 429 lockout only happens for real accounts. Both are normal for a sign-up form at this scale.

### Docs

Add an "Auth API" section to `backend/README.md` (endpoints, cookie behaviour, `SECRET_KEY`, the 401/404 rules, and how to hand an old household to an account with a SQL `UPDATE`).

## Rollout notes

- Once this deploys, every existing frontend call returns 401 until the frontend login PR ships, and existing households are hidden until claimed. Merge and deploy this together with, or just before, the frontend login PR.
- Show the migration to the teammate who owns the Supabase schema before merging. Mention that the existing tables also have RLS off. That's out of scope here, but worth their look.
- Teammates' local `backend/.env` now needs `SECRET_KEY`, or the app (and `flask db upgrade`) won't start. Say so in the PR notes.

## Smaller calls made during review

- Unknown `/api` paths return 401 when logged out, because the hook runs before routing errors surface, and 404 when logged in. No special handling.
- The lockout counter is updated atomically in SQL (`failed_login_count = failed_login_count + 1`) so two simultaneous wrong guesses can't both slip under the limit.

## Left to the builder

- Exact file layout inside `app/blueprints/auth/` (follow the other blueprints).
- Where the `before_request` hook lives (e.g. `app/auth.py` or inside the auth blueprint package), as long as it is registered app-wide.
- Wording of validation messages other than the ones fixed above.
- How to verify locally without touching live Supabase (e.g. a throwaway local Postgres pointed to by `DATABASE_URL`, run on port 5001, exercised with `curl` or the Vite dev server via `API_URL=http://127.0.0.1:5001`).
