# Guest Mode and Household Dialog — Design

**Date:** 2026-11-23
**Scope:** Frontend only. Uses the guest API from PR #21 (`POST /api/auth/guest`).
**Builds on:** `2026-11-23-web-login-design.md`.

## Why

A login wall before anyone has seen the app loses people. The backend can now make guest sessions, so the app can open straight away and offer an account later, keeping everything the guest added.

## Decisions (agreed with the user)

- **Everyone starts as a guest.** With no login, the app calls `/auth/guest` by itself. There is no redirect to `/login`.
- **Sidebar:** a guest sees "Guest", "Create an account to keep your data." and **Log in** / **Create account** links. An account sees its name and **Log out**. Guests get no Log out (it would only throw their data away).
- **Log out** ends the account session and continues as a fresh guest.
- **Create account** as a guest upgrades that guest (data kept). **Log in** as a guest merges the guest's data into the account. Both are backend behaviour; the pages only stop redirecting guests away.
- **Household setup is a dialog** (shadcn `Dialog`) shared by every page. It opens by itself when the user has no household. Closing it leaves a **Set up household** button on the page; **Add household** sits next to the household picker.

## Approaches considered

- Keep the login wall and add a "Continue as guest" button on `/login` (first proposal). Replaced by the user's choice above.
- Household setup inline on the Appliances page only (old behaviour). Other pages could only say "go to Appliances". Replaced by one app-wide dialog.

## How it works

- `api.js`: `guest()`; `fromUser()` maps `is_guest` to `isGuest`. A refresh ends the login only on **401**; a 5xx or network error keeps it (otherwise a server hiccup would silently swap the user for a new guest).
- `useAuth`: `user` is `undefined` while checking, `null` when the server can't be reached (shown as "Can't connect" with **Try again**), otherwise the user. `auth:expired` starts a new guest, except while a session is already starting (a first visit's 401 fires it too).
- `AppShell` (was `RequireAuth`): the layout for app pages. Wraps them in `HouseholdsProvider` keyed by user id, so a new user starts with their own households.
- `useHouseholds` is now a context with the same return shape, plus `openSetup()`. All pages, including Appliances, share one list and one selected household.
- `HouseholdDialog` returns focus to the button that opened it, or to `#main` when it opened by itself or that button is gone (there is no `DialogTrigger`, so Radix can't).

## Left out

- Telling guests how long their data lasts (the backend removes guests 30 days after their last visit).
- Editing or deleting households.
- The Solar page's own "no household" text: its files hold a teammate's uncommitted edits. It still gets **Add household** through the shared picker.
