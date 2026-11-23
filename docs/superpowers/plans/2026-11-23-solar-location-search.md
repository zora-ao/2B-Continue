# Solar Location Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Solar page's fixed 10-city list with place search and "Use my location", with sun-hours from 12 months of real Open-Meteo sunlight.

**Architecture:** A new `places.py` in the solar blueprint talks to Open-Meteo (geocoding and archive). The solar profile stores a rounded point, a name and its sun-hours instead of a city key. The frontend swaps the Location select for a shadcn combobox plus a geolocation button.

**Tech Stack:** Flask, SQLAlchemy, Alembic, pytest on Postgres; React 19, shadcn (popover, command), plain JS.

**Spec:** `docs/superpowers/specs/2026-11-23-solar-location-search-design.md`

## Global Constraints

- Frontend: plain JavaScript, no tests, no TypeScript (CLAUDE.md). Verify with `npm run build` and a browser check against a throwaway backend, never port 5000.
- Backend tests run on a throwaway local Postgres: `TEST_DATABASE_URL=postgresql+psycopg://tester@127.0.0.1:5433/<db>`. Tests never hit the network: `SOLAR_WEATHER_ENABLED` is already `False` in `conftest.py`, and Open-Meteo calls are monkeypatched.
- Coordinates: rounded to 2 decimals; latitude 4–22, longitude 116–127.
- Default place: Metro Manila, 14.60, 120.98, 4.5 sun-hours, `sun_hours_estimated = true`.
- Fallback sun-hours: `Decimal("4.5")`.
- `api.js` is the only file that converts snake_case to camelCase.
- No AI attribution in commits or PRs.
- The migration's parent is the current head `a5112026cafe`.
- Before Task 4, the teammate's uncommitted edits in `frontend/src/pages/Solar/` must be committed or dropped by their owner.

## Review Focus

1. Open-Meteo down or slow during a save: the save must still succeed, with 4.5 and `estimated = true`, not a 500.
2. Live profiles after the migration: every old `location_key` maps to its city; an unknown key falls back to Metro Manila instead of failing the upgrade.
3. Location permission denied or unavailable in the browser: a clear message next to the button, and the field stays usable.
4. Fast typing: older search responses must not replace newer ones (abort the previous request).
5. A search with no results, or Open-Meteo failing: "No places found" or an error message in the list, not an empty open popover.

---

### Task 1: Open-Meteo place search and yearly sun-hours

**Files:**
- Create: `backend/app/blueprints/solar/places.py`
- Test: `backend/tests/test_solar_places.py`

**Interfaces:**
- Produces:
  - `search_places(query: str) -> list[dict]`: each `{"name": str, "region": str | None, "latitude": float, "longitude": float}`, coordinates rounded to 2 decimals. Raises `PlaceSearchError` on network or parse failure. Uses `https://geocoding-api.open-meteo.com/v1/search` with `name`, `count=8`, `language=en`, `countryCode=PH`, `format=json`. A missing `results` key means `[]`. Cached for 1 hour per lowercased query.
  - `yearly_sun_hours(latitude: Decimal, longitude: Decimal, today: date) -> Decimal | None`: the mean of non-null daily `shortwave_radiation_sum ÷ 3.6` from `https://archive-api.open-meteo.com/v1/archive`, for `today - 370 days` to `today - 5 days`, rounded to 2 decimals. Returns `None` on any failure, when `SOLAR_WEATHER_ENABLED` is false, or when there are no values.
  - `class PlaceSearchError(Exception)`.
- Both send `User-Agent: Kuryenta/1.0` and use the `SOLAR_WEATHER_TIMEOUT` config (default 5 s), like `weather.py`.

- [ ] **Step 1: Write the failing tests** with a fake `urlopen` (monkeypatch `app.blueprints.solar.places.urlopen` to return an object whose `json.load` yields the payload):
  - `test_search_places_maps_results`: the payload `{"results": [{"name": "Batangas City", "admin1": "Calabarzon", "latitude": 13.7565, "longitude": 121.0583}]}` gives `[{"name": "Batangas City", "region": "Calabarzon", "latitude": 13.76, "longitude": 121.06}]`; the requested URL contains `countryCode=PH`.
  - `test_search_places_no_results`: `{}` gives `[]`.
  - `test_search_places_failure`: `urlopen` raising `URLError` raises `PlaceSearchError`.
  - `test_yearly_sun_hours_mean` (run with `SOLAR_WEATHER_ENABLED=True` in the app config): radiation `[18.0, None, 18.72]` gives `Decimal("5.10")`.
  - `test_yearly_sun_hours_disabled_or_failing`: returns `None` when disabled, and when `urlopen` raises.
- [ ] **Step 2: Run** `pytest tests/test_solar_places.py -q`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement `places.py`** to the interfaces above (reuse the cache-and-lock pattern from `weather.py`).
- [ ] **Step 4: Run** `pytest tests/test_solar_places.py -q`. Expected: 5 passed.
- [ ] **Step 5: Commit** `feat(backend): search places and yearly sun-hours from Open-Meteo`.

### Task 2: Profile stores a place instead of a city key

**Files:**
- Create: `backend/migrations/versions/b2d4f6a8c013_solar_profile_place.py`
- Modify: `backend/app/models/solar_profile.py`, `backend/app/blueprints/solar/catalog.py`, `backend/app/blueprints/solar/routes.py`
- Test: `backend/tests/test_solar_location.py`

**Interfaces:**
- Consumes: `search_places`, `yearly_sun_hours`, `PlaceSearchError` from Task 1.
- Produces (the API the frontend uses):
  - `profile.location` in `GET /solar`, `GET/PUT /solar/profile`, and `recommendations.location` is `{"name": str, "latitude": float, "longitude": float, "sun_hours": float, "sun_hours_estimated": bool, "is_default": bool}`.
  - `PUT /solar/profile` accepts `location: {"name", "latitude", "longitude"}` (and still `install_budget`, `system_kw`, `panel_watts`). `location_key` is now rejected by the existing "Only … are accepted" check.
  - `GET /solar/places?q=…` returns `200 {"items": [...]}`; `q` shorter than 2 or longer than 100 characters after trimming gives 400; `PlaceSearchError` gives `502 {"error": "Place search is unavailable. Try again."}`.
  - `GET /solar` no longer has `locations`; `GET /solar/locations` is gone (404).
- Model: add the 5 columns from the spec and drop `location_key`. The migration (revision `b2d4f6a8c013`, parent `a5112026cafe`) adds the columns as nullable, fills them from an inline copy of the 10-city table (unknown keys get Metro Manila), sets them NOT NULL, then drops `location_key`. `downgrade()` re-adds `location_key`, sets it to `"metro_manila"` and drops the 5 columns.
- `catalog.py`: remove `LOCATIONS`, `DEFAULT_LOCATION` and `serialize_location`; add the `DEFAULT_PLACE` dict and `FALLBACK_SUN_HOURS = Decimal("4.5")`.
- `routes.py`: `parse_place(value) -> dict` validates and rounds; `profile_settings` returns name, latitude, longitude, sun_hours, sun_hours_estimated and is_default; `recommendation_section` and `performance_section` read sun-hours and coordinates from those settings; `overrides()` keeps only `install_budget`; `guess_location` is removed.

- [ ] **Step 1: Write the failing tests** (as a guest with one household, like `test_scans.py`):
  - `test_default_location_is_metro_manila`: `GET /solar` gives `profile.location == {"name": "Metro Manila", "latitude": 14.6, "longitude": 120.98, "sun_hours": 4.5, "sun_hours_estimated": True, "is_default": True}`, and there is no `locations` key.
  - `test_save_place_uses_yearly_sun_hours`: with `yearly_sun_hours` monkeypatched to `Decimal("5.10")`, a PUT with `{"name": "Batangas City", "latitude": 13.7565, "longitude": 121.0583}` gives 201 and a location of 13.76 / 121.06, `sun_hours` 5.1, not estimated and not default; `recommendations.location` matches.
  - `test_save_place_falls_back_when_sunlight_unavailable`: patched to return `None`, it gives `sun_hours` 4.5 and estimated.
  - `test_save_place_rejects_bad_input`: `latitude: 40` gives 400; an empty name gives 400; `location_key: "cebu"` gives 400.
  - `test_places_search`: patched `search_places` passes `q` through and returns items; `q="a"` gives 400; `PlaceSearchError` gives 502.
- [ ] **Step 2: Run** `pytest tests/test_solar_location.py -q`. Expected: FAIL.
- [ ] **Step 3: Implement** the model, `catalog.py` and `routes.py` changes to the interfaces above.
- [ ] **Step 4: Run** the whole suite `pytest -q`. Expected: all pass (the existing count plus 5).
- [ ] **Step 5: Write the migration**, then check it on a database shaped like live. On a fresh throwaway Postgres, `flask db upgrade a5112026cafe`, insert a household plus a `solar_profiles` row with `location_key='cebu'`, run `flask db upgrade`, and expect the row to read Cebu City / 10.32 / 123.89 / 5.00 / estimated. Then `flask db downgrade a5112026cafe` and expect it to succeed.
- [ ] **Step 6: Commit** `feat(backend): store solar location as a searched place`.

### Task 3: Frontend API for places

**Files:**
- Modify: `frontend/src/api.js`

**Interfaces:**
- Consumes: Task 2's API.
- Produces:
  - `fromSolarProfile(profile)` returns `{ location, installBudget, systemKw, panelWatts }`, where `location` is `{ name, latitude, longitude, sunHours, sunHoursEstimated, isDefault }` (one `fromPlace` helper, also used for `recommendations.location`).
  - `api.getSolar` returns `{ profile, recommendations, mySystem }` (no `locations`).
  - `api.saveSolarProfile(householdId, { location: { name, latitude, longitude } | …})`.
  - `api.searchPlaces(householdId, query, options)` returns `[{ name, region, latitude, longitude }]`.
- Delete `fromLocation` if nothing else uses it.

- [ ] **Step 1: Make the changes.** Run `npm run build`. Expected: it builds (`SolarPage` still references `locations`; that is fixed in Task 4, so keep a temporary `?? []` there only if the build fails).
- [ ] **Step 2: Commit** with Task 4 (one frontend commit).

### Task 4: Location search box and "Use my location"

**Files:**
- Add: `frontend/src/components/ui/popover.jsx` and `command.jsx` (`npx shadcn@latest add popover command`, answering `n` to any overwrite prompt)
- Create: `frontend/src/pages/Solar/LocationPicker.jsx`
- Create: `frontend/src/lib/geolocation.js`
- Modify: `frontend/src/pages/Solar/RecommendedSystems.jsx`, `frontend/src/pages/Solar/SolarPage.jsx`

**Interfaces:**
- Consumes: Task 3's `api.searchPlaces`, `api.saveSolarProfile`, `location` shape.
- Produces:
  - `LocationPicker({ householdId, location, onPick, busy })`, where `onPick(place)` gets `{ name, latitude, longitude }`.
  - `currentPosition() -> Promise<{ latitude, longitude }>` in `lib/geolocation.js`: rounds to 2 decimals, uses `enableHighAccuracy: false` and `timeout: 10000`, and rejects with an `Error` whose message is user-ready ("Location permission was denied.", "Your location isn't available right now.", "This browser can't share its location.").
- `SolarPage`: `handleLocationChange(place)` calls `saveProfileAndRefresh({ location: place })`, and then updates `solar.profile.location` from the save response. It drops the `locationKey` state and the `locations` prop.
- `RecommendedSystems`: replaces the Select with `<LocationPicker>` and shows "`{name}` · `{sunHours}` sun-hours a day (last 12 months)", with "(estimate)" when `sunHoursEstimated` and "(default)" when `isDefault`.
- `LocationPicker` behaviour: wait 300 ms after typing, and search only with 2+ characters; cancel the previous request with `AbortController`; show "Searching…", "No places found" and errors inside the list; "Use my location" saves `{ name: "My location", ...coords }`; the Popover closes and focus returns to the input after a pick.

- [ ] **Step 1: Run modern-web-guidance** searches for "combobox autocomplete input" and "geolocation permission", retrieve the matching guides, and apply them within the shadcn components.
- [ ] **Step 2: Build it** to the interfaces above. Run `npm run build`. Expected: it builds.
- [ ] **Step 3: Browser check** against a throwaway backend running Task 2's code, with `SOLAR_WEATHER_ENABLED` true so real Open-Meteo is used:
  - search "Batangas", pick it, and expect the sun-hours line and the recommendations to change;
  - type quickly and expect only the last results;
  - "zzzz" shows "No places found";
  - **Use my location**, plus a denied permission (emulated), shows the message;
  - keyboard only: type, arrow keys, Enter, Escape.
- [ ] **Step 4: Commit** `feat(frontend): search solar location or use my location`.

### Task 5: Final check and PR

- [ ] **Step 1:** Run the whole backend suite on the throwaway Postgres, plus `npm run build`.
- [ ] **Step 2:** Run a whole-branch review (fresh reviewer), and fix what it finds.
- [ ] **Step 3:** Push and open a short PR (Summary / Testing / Notes). The Notes cover the migration, and that Render applies it on deploy.
