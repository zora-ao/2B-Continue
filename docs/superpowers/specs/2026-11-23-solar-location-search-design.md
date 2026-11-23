# Solar Location Search — Design

**Date:** 2026-11-23
**Scope:** Backend (solar blueprint, one migration) and frontend (Solar page location field).

## Why

The Solar page offers a fixed list of 10 cities (`backend/app/blueprints/solar/catalog.py`), each with a hand-typed sun-hours value. Anyone outside those cities picks the "closest" one, and the most important number in the recommendations is a guess. The user wants real places and real sunlight.

## Goals

- Search any Philippine place by name, or press **Use my location**.
- Sun-hours come from the place's **real average daily sunlight over the last 12 months** (Open-Meteo history), not a typed number.
- The saved place and its sun-hours are shown under the field.
- Existing profiles keep working after the migration.

## Non-goals

- Turning browser coordinates into a town name (Open-Meteo has no reverse geocoding; another service was declined). Such a result is labelled **"My location"**.
- The wider Solar page refactor (sections, summary line, chart accessibility). That comes next, separately.
- Places outside the Philippines.

## Anti-goals

- Storing a home's exact position. Browser coordinates are rounded to 2 decimals (about 1 km) **before they leave the browser**, and the server rounds every location to 2 decimals too.
- The Solar page breaking when Open-Meteo is down.

## Approaches considered

1. **Search + Use my location (chosen by the user).**
2. Search only: no permission prompt, but people must type their town.
3. A bigger live list (for example all provinces): least change, but still a list.

## Decisions

- **Profile fields:** `location_key` is replaced by `location_name` (String 120), `latitude` (Numeric 5,2), `longitude` (Numeric 6,2), `sun_hours` (Numeric 4,2) and `sun_hours_estimated` (bool).
- **Migration:** each existing profile gets its old city's name, coordinates and sun-hours, with `sun_hours_estimated = true` (they are the old typed values). `downgrade()` maps back to `metro_manila`.
- **Default:** a household without a saved profile uses Metro Manila (14.60, 120.98, 4.5 sun-hours), shown as "Metro Manila (default)".
- **Search:** `GET /api/households/<id>/solar/places?q=` (2–100 characters) calls Open-Meteo geocoding with `countryCode=PH`, `count=8`, and returns `{items: [{name, region, latitude, longitude}]}`. If Open-Meteo fails, the response is 502 `{error}`. Results are cached for an hour per query.
- **Saving:** `PUT /solar/profile` accepts `location: {name, latitude, longitude}`. The name is 1–120 characters; coordinates must lie in the Philippines' bounding box (latitude 4–22, longitude 116–127), and both are rounded to 2 decimals. The server then works out sun-hours as the mean daily `shortwave_radiation_sum` (MJ/m² ÷ 3.6) over the 365 days ending 5 days ago, from the Open-Meteo archive. If that fails or weather is disabled, it uses 4.5 with `sun_hours_estimated = true`; the next save tries again.
- **Weekly expected output** uses the profile's own coordinates and sun-hours.
- **Removed:** the `LOCATIONS` list, `GET /solar/locations`, the `locations` field of `GET /solar`, and the `location` what-if query parameter (the frontend never used it).
- **Frontend:** the Location select becomes a search box with suggestions (shadcn Popover + Command, the shadcn combobox recipe) plus a **Use my location** button. Searches wait 300 ms after typing and cancel the previous one. Below the field: "Batangas City · 4.7 sun-hours a day (last 12 months)", or "(estimate)" when `sun_hours_estimated`.

## Left to the builder

Copy wording, the exact suggestion layout, error wording for a denied location permission, and the cache size limit.

## Before building

The four uncommitted Solar files (a teammate's edits, two of them broken) must be committed or dropped first, since `RecommendedSystems.jsx` is rewritten here.
