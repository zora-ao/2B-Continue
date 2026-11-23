# Login & Register (backend) — Design

**Date:** 2026-11-23 (revised the same day: Flask session → JWT, for web + mobile)
**Project:** EnergyWise — SDG 7 energy-saving web app (a mobile app is planned too)
**Scope:** Backend only (`backend/`). The web login/register pages and the mobile app are separate, later work.
**Branch:** `feat/login-register-back`. It already holds an unpushed version built on Flask's session cookie (commits `018378a..5ce54ed`). This revision reworks that branch to JWT before the PR opens, so the cookie-session version never ships.

## Why

Today the API has no idea who is using it. `GET /api/households` returns every household, and every other endpoint works off the household id in the URL, so anyone who can reach the API can read or change anyone's bills, readings, solar setup, and alerts. We want EnergyWise to be private per user: a person registers, logs in, lands on the dashboard, and from then on sees and changes only their own households.

The team is building a **web app and a mobile app** on the same API and agreed on **JWT**. A mobile app isn't a browser and can't lean on the website's cookie, so it needs a token it stores and sends itself. JWT is the standard for that.

## Goals

- Register with **name, email, password**; log in with **email + password**; log out; ask "who am I"; refresh an expired login.
- The **same backend serves web and mobile**. Web keeps tokens where page JavaScript can't read them; mobile gets tokens to store in the phone's secure storage.
- Logins last **30 days** without the user noticing, but a stolen access token is only useful for **15 minutes**, and **logout really logs that device out**.
- Every `/api` endpoint except register, login, logout, refresh, and health requires a logged-in user.
- A user can only reach households they own (and everything under them: appliances, budget plans, dashboard, readings, solar, alerts).
- `GET /api/households` lists only the user's households; `POST /api/households` makes the new one theirs.

## Non-goals (this PR)

- Web login/register pages, route guards, the refresh-and-retry logic in `api.js`, and the mobile app itself (later).
- Forgot / reset / change password (later PR; needs an email service). **When it's built, it must delete all of that user's refresh tokens.** Until then a forgotten password is reset by hand in Supabase.
- "Log out of all devices", a list of logged-in devices, rate limiting on refresh. The `refresh_tokens` table makes these easy to add later.
- Email verification, two-factor login, CAPTCHA.
- Sharing a household between users, roles, or admin accounts; editing a profile or deleting an account.
- Claiming households that existed before this change.

## Anti-goals

- **Changing or deleting existing Supabase data or tables.** A teammate owns the schema. The migration may only add things.
- Ownership checks scattered across the other teammates' blueprints, where one missed route silently leaks data.
- Storing passwords in plain text, or giving the **web** app a token that page JavaScript can read.
- Two separate login systems for web and mobile.

## Constraints

- Flask + Flask-SQLAlchemy + Alembic (Flask-Migrate) on Supabase Postgres; deployed on Render (`render.yaml` runs `flask db upgrade` on start). The web frontend on Vercel rewrites `/api/*` to Render; locally Vite proxies `/api` to Flask, so the **browser** always talks to a single origin. The mobile app calls the Render URL directly; CORS doesn't apply to native apps.
- One new runtime dependency: **`flask-jwt-extended`** (it brings PyJWT). Tokens are signed with `SECRET_KEY`, using HS256.
- Never test against the real backend on port 5000 / live Supabase (`CLAUDE.md`).
- Follow the existing style: models in `app/models/`, one blueprint per feature in `app/blueprints/<name>/`, errors as `{"error": "..."}` via `app/errors.py`, `json_payload()` for request bodies.

## Approaches considered

**How login is remembered**

1. Flask's signed session cookie (what the branch has now). Simple and safe for the browser, but awkward for a native mobile app, and not what the team agreed on.
2. **JWT via `flask-jwt-extended` — chosen** (team decision). A standard token that both web and mobile can carry.

**Where the JWT travels (web + mobile)**

1. **One login system, two carriers — chosen.** Same tokens for both. Web gets them in `HttpOnly` cookies plus a CSRF header; mobile gets them in the JSON response and sends `Authorization: Bearer`. `flask-jwt-extended` accepts either (`JWT_TOKEN_LOCATION = ["cookies", "headers"]`). Cost: login has to know which kind of app is calling.
2. Bearer header everywhere, web included. One code path, but on the web the token sits where any injected script or bad npm package can read it.
3. Keep the Flask session for web and add JWT only for mobile. Two login systems to secure and keep in sync.

**How long a login lasts**

1. One long-lived token. Least code, but logout can't cancel it and a copied token works until it expires.
2. **15-minute access token + 30-day refresh token, refresh tokens recorded in the database — chosen.** Long logins, short exposure, real logout. Cost: one table, one endpoint, and a "refresh once and retry" step in each app.
3. A long token plus a blocklist table checked on every request. Real logout, but a lookup on every request and a table that keeps growing, without option 2's short exposure.

**How ownership is enforced on existing endpoints**

1. **One central check — chosen.** An app-wide `before_request` hook requires a valid access token on every `/api` request (except the public endpoints) and, when the matched URL has a `household_id`, checks that the household belongs to that user. Every current route is covered without editing it.
2. Add an owner filter to each blueprint's household lookup. Touches about six teammate-owned files, and a miss leaks silently.
3. A decorator on each route. Relies on remembering it on every route forever.

**Households created before login existed**

1. **Leave them unowned (`user_id` NULL) — chosen.** Invisible to everyone, not deleted; one SQL `UPDATE` hands one to an account.
2. Make `user_id` required. Would force filling in or deleting existing rows.
3. Give them all to the first account that registers. Surprising and risky.

## Decided

### Database (one migration, `down_revision = "e3a1c5d7f902"`)

All of these are additions; nothing existing changes.

`users`, as already built:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | |
| `name` | varchar(120), not null | trimmed, 1–120 chars |
| `email` | varchar(254), not null, unique (`uq_users_email`) | stored trimmed + lowercased |
| `password_hash` | varchar(255), not null | Werkzeug `generate_password_hash` (scrypt) |
| `failed_login_count` | integer, not null, default 0 | lockout |
| `locked_until` | timestamptz, nullable | lockout |
| `created_at` | timestamptz, not null | UTC |

New `refresh_tokens`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | integer PK | |
| `user_id` | integer, not null, FK → `users.id` `ON DELETE CASCADE`, indexed | |
| `jti` | varchar(64), not null, unique | the token's unique id. **The token itself is never stored.** |
| `expires_at` | timestamptz, not null | 30 days after issue |
| `used_at` | timestamptz, nullable | set when this token is swapped for a new one |
| `created_at` | timestamptz, not null | UTC |

`households` gets `user_id` integer, **nullable**, FK → `users.id`, indexed.

RLS is enabled with **no policies** on both `users` and `refresh_tokens`, so Supabase's Data API can't read them. Flask connects as `postgres`, which bypasses RLS. Downgrade reverses everything.

The migration already on the branch (`f4b2d8c61a37`) has never been applied anywhere shared, so it is **edited in place** to add `refresh_tokens`, not followed by a second migration.

### Tokens

- **Access token:** lasts 15 minutes. Its payload holds only the user id as `sub` (a **string**, as PyJWT requires), plus the standard fields `flask-jwt-extended` adds (`exp`, `iat`, `jti`, `type`, …). No name, no email.
- **Refresh token:** lasts 30 days, same minimal payload, and a row in `refresh_tokens` keyed by its `jti`. **The 30 days slide** (user's decision): each refresh issues a new refresh token with a fresh 30 days, so someone who opens the app at least once a month stays logged in, and 30 days of inactivity means logging in again. No login start time is stored.
- **Issuing tokens** (on register, login, and refresh): create one access token and one refresh token, and insert the refresh row.
  - **Web** (no `X-Client: mobile` header): set them as cookies; the body holds only `{"user": {...}}`.
  - **Mobile** (`X-Client: mobile`): no cookies; the body is `{"user": {...}, "access_token": "...", "refresh_token": "..."}`.

### Web cookies

- `JWT_TOKEN_LOCATION = ["cookies", "headers"]`.
- The access cookie has path `/api`. The refresh cookie has path `/api/auth`, so it reaches refresh and logout but no other route.
- Cookies are `HttpOnly` and `SameSite=Lax`, and `Secure` unless `FLASK_DEBUG == "1"`. They are **persistent with a 30-day `Max-Age`** (`JWT_SESSION_COOKIE = False`), so web logins survive closing the browser.
- **CSRF:** `flask-jwt-extended`'s double-submit protection stays on (`JWT_COOKIE_CSRF_PROTECT = True`). It sets readable `csrf_access_token` and `csrf_refresh_token` cookies. The web app copies the matching one into an `X-CSRF-TOKEN` header on POST, PUT, PATCH, and DELETE requests and on refresh. Requests that carry a Bearer header (mobile) don't need it.

### Endpoints (blueprint `auth`, at `/api/auth`)

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/register` | `{name, email, password}` | 201, tokens issued | 400 invalid; 409 `"An account with this email already exists."` |
| POST | `/login` | `{email, password}` | 200, tokens issued | 400 invalid body; 401 `"Email or password is incorrect."`; 429 `"Too many failed attempts. Try again in 15 minutes."` |
| POST | `/refresh` | none (refresh cookie, or `Authorization: Bearer <refresh token>` from mobile) | 200, new tokens issued | 401 `"Please log in."` |
| POST | `/logout` | none (refresh cookie, or Bearer refresh token from mobile) | 204 | never fails |
| GET | `/me` | — (access token) | 200 `{"user": {...}}` | 401 `"Please log in."` |

The user object is `{"id", "name", "email"}`. Validation (`validation.py`) and the lockout are unchanged from the current branch.

- **On refresh and logout, the token's source decides the reply, not the header.** *(Builder's call, from review.)* A refresh token that arrived in a cookie always gets cookies back; one that arrived as a Bearer header gets JSON back. This uses `get_jwt_request_location()`, and `X-Client` is ignored on these two endpoints. Otherwise a script injected into the web page could call refresh with `X-Client: mobile` and receive a readable 30-day token. `X-Client` only matters on register and login, which need the password anyway.
- **Refresh rotates:** the old row gets `used_at = now` and a new pair is issued. Possible outcomes:
  - **Valid token, row unused and not expired:** rotate and return the new pair.
  - **Row missing** (logged out, or cleaned up): 401 `"Please log in."`.
  - **Row used within the last 30 seconds:** **409** `{"error": "Refresh already used."}`. Nothing is revoked. *(Builder's call, from review.)* This is two tabs or retries racing. Web: retry the original request once, since another tab has already set fresh cookies; if that gets 401, show login. Mobile: show login (rare, e.g. when the refresh response was lost on the network).
  - **Row used more than 30 seconds ago:** the token was copied and replayed. **Delete every refresh token for that user**, then 401.
- **Logout:** it tries to read a refresh token. If one is valid and passes CSRF, its row is deleted. Any error (missing, expired or invalid token, or a failed CSRF check) is caught; the cookies are still cleared and the row simply expires. Always 204. *(Builder's call, from review: `SameSite=Lax` already blocks cross-site logout, and a leftover row is harmless.)*
- **Implementation notes from review** *(builder's calls)*:
  - The CSRF cookies keep the library's default path `/` so page JavaScript can read them.
  - The 30-day cookie `Max-Age` is set explicitly; the library's default is about 68 years.
  - Every `flask-jwt-extended` error callback, including user-lookup failures and wrong token type, returns the spec's 401 JSON instead of the library's `msg` or 422 replies.
  - Pin `flask-jwt-extended>=4.7,<5` (string `sub`).
  - If a request carries both a cookie and a Bearer header, the cookie wins.
- **Cleanup:** on each successful login, delete that user's rows that have expired or were used more than a day ago. No scheduled job.

### The central check (`before_request`, in `guard.py`)

For each request whose path starts with `/api`:

1. Skip `OPTIONS` and the public endpoints: `auth.register`, `auth.login`, `auth.refresh`, `auth.logout`, `api.health`.
2. Check for a valid **access** token from the cookie or the Bearer header (`verify_jwt_in_request()`; refresh tokens are rejected here). If it's missing, expired, invalid, the wrong type, or fails the CSRF check, or if the user in `sub` no longer exists, return **401** `{"error": "Please log in."}`.
3. Put the user on `flask.g.user`.
4. If `request.view_args` contains `household_id` and that household isn't owned by `g.user`, return **404** with the existing "Requested resource not found." message.

All `flask-jwt-extended` error callbacks (`unauthorized_loader`, `invalid_token_loader`, `expired_token_loader`, …) return the same 401 JSON, so the apps follow one rule. **On 401, call refresh once, then retry the original request. If refresh returns 401, show login. If refresh returns 409, web retries the original request once (another tab already refreshed); mobile shows login.**

### Households routes (the only existing routes edited)

- `GET /api/households` filters by `Household.user_id == g.user.id`.
- `POST /api/households` sets `user_id = g.user.id`.

### Security summary

- Passwords are hashed with scrypt and capped at 128 characters. Unknown emails still run a dummy hash check, so response time doesn't reveal accounts. The same 401 message covers an unknown email and a wrong password. The 5-failure, 15-minute lockout is updated atomically.
- Web tokens are kept away from page JavaScript (`HttpOnly`), with CSRF double-submit protection. Mobile keeps tokens in the phone's secure storage; that's the mobile team's responsibility, noted for them.
- Access tokens are short-lived (15 minutes). Refresh tokens rotate and are recorded, logout deletes them, and a replayed refresh token cancels every login for that user.
- No personal data inside tokens.
- Accepted leaks, as before: register's 409 for a taken email, and the 429 lockout only happens for real accounts.

### Config and docs

- `SECRET_KEY` is still required at startup; it signs the JWTs. It goes in `.env.example`, and in `render.yaml` with `generateValue: true`.
- `requirements.txt` gains `flask-jwt-extended` (pin a range, as the file does for its other packages).
- The "Auth API" section of `backend/README.md` is rewritten for JWT: both carriers, the `X-Client: mobile` header, the CSRF header for web, token lifetimes, refresh and logout behaviour, the refresh-and-retry rule, and the reminder that password reset must delete refresh tokens.

## Rollout notes

- Once this deploys, every existing web frontend call returns 401 until the web login PR ships, and existing households are hidden until claimed. Merge and deploy it together with, or just before, the web login PR.
- Before merging, check Render: `generateValue` only applies if the service is managed by the Blueprint. Otherwise set `SECRET_KEY` by hand.
- Teammates' local `backend/.env` needs `SECRET_KEY`.
- Show the migration to the teammate who owns the Supabase schema. Mention that the existing tables have RLS off too; that's outside this PR.

## Left to the builder

- File layout inside `app/blueprints/auth/` (for example a small `tokens.py` for issuing and rotating tokens).
- How tests send the CSRF header and Bearer tokens; the current 46 tests are updated rather than rewritten from scratch.
- Wording of validation messages other than those fixed above.
- How to verify locally without touching live Supabase (a throwaway local Postgres, as before).
