# Web Login — Design

**Date:** 2026-11-23
**Scope:** Frontend only. Uses the auth API from PR #18 (`backend/app/blueprints/auth/`).

## Why

Since #18, every `/api` route except auth and health returns 401 without a login. The web app has no login, so the deployed site is unusable. This adds login, register, and everything the frontend needs to keep working while logged in.

## Goals

- `/login` and `/register` pages.
- Logged-out visitors to any app page are sent to `/login`, then returned to the page they wanted.
- `api.js` sends the CSRF header on writes, and quietly refreshes an expired login once before giving up.
- The sidebar shows the user's name and a **Log out** button.

## Non-goals

- Forgot/reset password (no backend support yet; the guide's "Forgot password" link is left out until then).
- Social login, profile editing, deleting accounts.
- Claiming households created before #18 (done by hand in Supabase).

## Anti-goals

- Reading or storing tokens in JavaScript or `localStorage`. The tokens stay in HttpOnly cookies; JS only reads the CSRF cookies, as the backend intends.
- A flash of the dashboard before the redirect to login.

## Approach (agreed)

One sensible way, approved by the user: separate full-page `/login` and `/register` cards without the sidebar, plus an auth context, a route guard, and CSRF/refresh handling inside `request()` in `api.js`. Tabs on one page or a modal were not chosen: separate routes are linkable and simpler.

## How it works

**API (`api.js`)**
- `login({email, password})`, `register({name, email, password})`, `logout()`, `me()` call `/auth/*`. They return `{user}` as `{id, name, email}`.
- On POST, PUT, PATCH and DELETE, `request()` adds `X-CSRF-TOKEN` from the `csrf_access_token` cookie.
- When a non-auth request gets **401**, `request()` calls `POST /auth/refresh` with `X-CSRF-TOKEN` from `csrf_refresh_token`, then retries the request once.
  - Only one refresh runs at a time; parallel 401s share it.
  - If refresh returns **409** (another tab just refreshed), retry the request anyway.
  - If refresh fails, it fires a `window` event `auth:expired` and throws the original 401.

**Auth state (`src/hooks/useAuth.jsx`)**
- `AuthProvider` loads `api.me()` on start. `user` is `undefined` while loading, `null` when logged out, and the user object when logged in.
- It exposes `login`, `register` and `logout`.
- It listens for `auth:expired` and sets `user = null`.

**Routes (`App.jsx`)**
- Public: `/login`, `/register`, `/scan/:code`. These have no sidebar.
- Everything else sits under a `RequireAuth` layout:
  - while loading, it shows a spinner;
  - when logged out, it does `<Navigate to="/login" state={{from}}>`;
  - otherwise it shows the sidebar plus the page.
- `/login` and `/register` redirect to `/` when already logged in.

**Pages (`src/pages/Auth/`)**
- They share the same `AuthCard` layout: logo, title, form, and a link to the other page.
- **Login:**
  - email: `type="email"`, `autocomplete="username"`, `required`, `spellcheck="false"`
  - password: `autocomplete="current-password"`, `required`, with a show/hide button
  - submit button: **Log in**
- **Register:**
  - name: `autocomplete="name"`, 1–120 characters
  - email: same as on Login
  - password: `autocomplete="new-password"`, `minLength=8`, `maxLength=128`, with the hint "At least 8 characters."
  - submit button: **Create account**
- The server's error message (401, 409, 429 or 400) is shown in a `role="alert"` line. Inputs are disabled while submitting.
- After login, go to `state.from` or `/`. After register, go to `/appliances`, where the existing household setup appears.

**Sidebar**
- The user's name and a **Log out** button, at the bottom on desktop and in the mobile menu. Log out calls `api.logout()`, sets `user = null`, and goes to `/login`.

## Verification

- `npm run build`.
- Browser check against the throwaway backend (port 5001, with `SECRET_KEY` and `FLASK_DEBUG=1` so cookies work over http). Its seed gets a test user who owns the test household. The test user's credentials live only in the uncommitted scratchpad script.
- Things to check:
  - the redirect to login and back
  - a wrong password, a taken email, and the lockout message
  - saving data while logged in (the CSRF header)
  - an expired access cookie being refreshed silently
  - log out

## Left to the builder

The exact spinner and layout spacing, the copy of hints, and the icon for the show-password toggle.
