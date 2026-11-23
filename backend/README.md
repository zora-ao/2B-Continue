# EnergyWise backend

## Auth API

Base path: `/api/auth`. Apply migration `f4b2d8c61a37` first. It adds a `users`
table (with row-level security on and no policies, so Supabase's Data API can't
read it) and a nullable `households.user_id`. Nothing else changes.

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| POST | `/register` | `{"name", "email", "password"}` | 201 `{"user"}`, logged in | 400 invalid, 409 email taken |
| POST | `/login` | `{"email", "password"}` | 200 `{"user"}` | 400 invalid body, 401 wrong email/password, 429 locked |
| POST | `/logout` | none | 204 | none |
| GET | `/me` | none | 200 `{"user"}` | 401 not logged in |

`user` is `{"id", "name", "email"}`. Emails are trimmed and lowercased; names are
1-120 characters; passwords are 8-128 characters and stored as Werkzeug scrypt
hashes. Five wrong passwords lock the account for 15 minutes (429), even for the
right password; a successful login resets the count.

**Session.** Login and register set Flask's signed session cookie: `HttpOnly`,
`SameSite=Lax`, `Secure` unless `FLASK_DEBUG=1`, valid for 7 days. The browser
calls the API through the Vite/Vercel `/api` proxy, so no CORS credentials setup
is needed. `SECRET_KEY` must be set or the app won't start: add a long random
value to your local `backend/.env`; Render generates one (`render.yaml`).

**Everything else requires login.** Every `/api` request except register, login,
logout, and `/api/health` returns 401 `{"error": "Please log in."}` without a
valid session. A `household_id` in the URL that isn't the user's returns 404, so
other users' ids can't be probed. `GET /api/households` lists only the user's
households, and `POST /api/households` makes the new one theirs.

**Households from before login** have no owner and are hidden from everyone. To
give one to an account:

```sql
UPDATE households SET user_id = <user id> WHERE id = <household id>;
```

**Tests.** `pip install -r requirements-dev.txt`, point `TEST_DATABASE_URL` at a
throwaway local Postgres database (only `localhost` is accepted), then run
`python -m pytest tests -q` from `backend/`.

## Solar API

Base path: `/api/households/<household_id>/solar`. No frontend files were
changed for this feature.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | base path | Whole Solar page: profile, location list, recommendations, `my_system` |
| GET | `/recommendations` | Recommended systems only (for live recalculation as inputs change) |
| GET | `/performance?week_of=YYYY-MM-DD` | "My panels" week chart, today card, monthly savings, alerts |
| GET | `/locations` | Location presets with average sun-hours |
| GET / PUT | `/profile` | Read / save location, install budget, installed system |
| POST | `/readings` | "Add reading": log or replace a day's generation (`date` in body) |
| PUT / DELETE | `/readings/YYYY-MM-DD` | Replace / remove that day's generation log |

The base path and `/recommendations` accept `?location=<key>&install_budget=150000`
as unsaved what-if overrides; `install_budget=` (empty) means no budget limit. The
base path also accepts `week_of` (any date in the week; default today). Weeks are
Monday-Sunday.

PUT `/profile` accepts any subset of these fields (missing fields are kept; the first
save returns 201):

```json
{"location_key": "metro_manila", "install_budget": 150000, "system_kw": 2, "panel_watts": 550}
```

`install_budget` and `system_kw` may be null. Until `system_kw` is set, `my_system`
is null and `/performance` returns 400. Without a saved profile, the location is
guessed from the household's `location` text, defaulting to Metro Manila.

Readings reuse the dashboard's solar log table and validation:
`{"date": "2026-11-22", "generation_kwh": 8.4, "self_consumed_kwh": 6}`
(`self_consumed_kwh` optional, cannot exceed generation).

**Recommendations.** Monthly usage comes from the average of meter-logged days in
the last 30 days (needs at least 7), else from appliance estimates, else is
unavailable (`usage.source`). Each 1/2/3 kW system reports estimated cost, monthly
generation (kW x sun-hours x 30.4 days x 0.80 performance ratio), monthly savings
(generation offsetting usage, at the household rate; excess export is not
credited), payback years, `covers_percent` (capped at 100), and `excess_kwh`.
`status` is `best_fit`, `available`, or `over_budget`. Best fit is the smallest
system within budget that covers at least 95% of usage; if none does, the largest
system within budget. Prices and sun-hours are indicative values in
`blueprints/solar/catalog.py`.

**My panels.** Expected daily output = system kW x that day's Open-Meteo
shortwave radiation (MJ/m² / 3.6 = peak sun hours) x 0.80. If Open-Meteo is
unreachable, the location's average sun-hours are used and `expected_source` /
`weather_source` is `location_average`. Responses are cached in memory (30 min
for recent dates). Weeks older than ~90 days use the Open-Meteo archive API.
Each day reports actual (null if not logged), expected, percent of expected,
`sunny` (WMO code 0-2), `is_future`, and `low_output`.

A finished day (before today) below 70% of expected raises a `low_output_<date>`
alert, e.g. "Friday dropped to 57%" with a check-for-dirt/shade/breaker message.
Today is excluded because a mid-day log would look like a fault.

`saved_this_month`: avoided grid cost for the current Manila month. It uses
`self_consumed_kwh` when logged, otherwise assumes all generation was used at
home (counts reported in `self_consumed_days` / `generation_assumed_days`).
`bill_reduced_percent` = solar offset / (solar offset + grid-meter usage), only
over days that have both a solar log and known grid usage; null otherwise.

Config: `SOLAR_WEATHER_ENABLED` (default true) and `SOLAR_WEATHER_TIMEOUT`
(seconds, default 5) can be passed via `create_app(test_config)`.

The `e3a1c5d7f902` migration creates `solar_profiles` (one row per household).

## Alerts API

Base path: `/api/households/<household_id>/alerts`. This feature changes backend
files only. Apply migration `e730b4a921cf` before using the new endpoints.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | base path | Alert list, category counts, unread count, pagination |
| GET | `/rules` | Saved toggles (or defaults) and current numeric thresholds |
| PATCH | `/rules` | Save one or more rule toggles and reevaluate the selected month |
| POST | `/refresh` | Evaluate stored readings/appliances and reconcile alert history |
| PATCH | `/<alert_id>` | Mark one household-owned alert read or unread |
| POST | `/mark-all-read` | Mark all alerts in the selected month read |

GET list query parameters:

- `month=YYYY-MM`: defaults to the current Manila month; future months rejected.
- `category=all|budget|usage|appliances|solar`: defaults to all.
- `status=active|resolved|all`: defaults to active.
- `read=all|read|unread`: defaults to all.
- `limit=50` (1-100), `offset=0` (nonnegative).

Response: `items`, `counts` (all and each category), `unread_count`, `total`,
`month`, `limit`, `offset`. Counts/unread cover the selected month and status
before category/read filtering; `total` covers the filtered list before pagination.
Items include numeric `id`, category/rule/severity, title/message, detail values,
optional action `{label, href}`, event date, UTC creation/update timestamps,
read status/timestamp, and active/resolved status/timestamp. Action URLs are hints
for future frontend integration, not executed redirects.

Examples:

```text
GET /api/households/1/alerts?category=usage&read=unread&month=2026-11
```

```jsonc
// PATCH /api/households/1/alerts/12
{"is_read": true}
```

```jsonc
// POST /api/households/1/alerts/mark-all-read or /refresh
{"month": "2026-11"}
```

An empty JSON object also selects the current month. Mark-all-read covers active
and resolved alerts in that month across all categories, regardless of list filters.
Refresh returns `month`, `created`, `resolved`, and `active` counts. Refresh does
not send external notifications. GET requests do not create alerts: call refresh
when first opening the page to backfill existing data, then load the list.

Rule PATCH accepts booleans only, for example:

```json
{
  "daily_limit_exceeded": true,
  "bill_over_budget": true,
  "unusual_spike": true,
  "wasteful_appliances": true,
  "solar_underperforming": true,
  "weekly_summary": false
}
```

Those values are also the defaults. Optional `?month=YYYY-MM` on rule GET/PATCH
selects thresholds and the month to reevaluate; toggles themselves are household-wide.
Disabling a rule resolves its active alerts across all months without deleting history.
Reenabling reevaluates the selected month; other months can be explicitly refreshed.

Rules match the page's behavior:

- Daily limit: logged daily kWh greater than budget / rate / calendar days.
- Bill over budget: average logged daily kWh times calendar days times rate
  exceeds budget. Missing days are not treated as zero.
- Unusual spike: usage greater than 115% of the average of up to seven prior
  logged days within 14 days, requiring at least three baseline days.
- Appliances: highest estimated active consumption and optional recorded standby
  consumption. Highest cost alone is not claimed to prove inefficiency. Potential
  hour-reduction savings are offered only for flexible appliances.
- Solar: logged generation below 70% of a positive manually supplied expectation.
- Weekly summary: recap for each elapsed Sunday with recorded usage, including
  the number of known days. It is generated on evaluation, not scheduled delivery.

Every meter/solar write or deletion checks the affected month and, when relevant,
the next month's 14-day usage baseline. Reading writes and alert updates commit
together. Rules PATCH and explicit refresh also evaluate conditions. After editing
appliances or saving/resetting plans, explicitly refresh to update their alerts.
Budget/rate use the month's saved plan when present, otherwise household settings.

Events have stable deduplication keys per day/month/appliance. Repeated checks
update details while retaining read state. Conditions no longer met are resolved;
if a resolved condition returns, it becomes unread again. This preserves history
without creating a duplicate on each reading. Old monthly events are not expired
automatically; filter by month or refresh a historical month as needed.

Optional evidence fields added for the screenshot's standby and solar warnings:

- Appliance POST/PATCH: `standby_watts` (nullable, nonnegative, 3 decimals) and
  `standby_hours_per_day` (defaults to 0). Active plus standby hours cannot exceed
  24. Both power and hours must be positive to create a standby alert. These are
  explicit manual inputs, not inferred from appliance type. Standby cost is a
  separate estimate; existing active-consumption calculations remain unchanged.
- Solar PUT: `expected_generation_kwh` (nullable, nonnegative, 3 decimals), in
  addition to existing generation/self-consumption fields. Without a positive
  expectation, no underperformance alert is generated. No fault cause is inferred.

The dashboard's alert preview and `/dashboard/alerts` now return the same saved
active alerts and read status; the overview includes `unread_alert_count`.

## Dashboard API

Base path: `/api/households/<household_id>/dashboard`. No frontend files were
changed for this feature.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | base path | Overview cards, budget, chart, appliance breakdown, top 3 alerts |
| GET | `/alerts` | All saved active dashboard alerts |
| GET | `/meter-readings` | Selected month's manual meter/usage logs |
| POST | `/meter-readings` | Log or replace a reading using a `date` in the body |
| PUT | `/meter-readings/YYYY-MM-DD` | Log or replace that date's reading |
| DELETE | `/meter-readings/YYYY-MM-DD` | Remove that date's reading |
| GET | `/solar-generation` | Selected month's manually logged solar generation |
| PUT | `/solar-generation/YYYY-MM-DD` | Log or replace that date's solar generation |
| DELETE | `/solar-generation/YYYY-MM-DD` | Remove that date's solar log |

GET endpoints accept `?month=2026-11`, defaulting to the current Manila month.
The overview also accepts `period=day|week|month` for the chart: last 14 days,
8 Monday-based weeks, or 12 calendar months ending in the selected month. Week
and month buckets stop at the as-of date. Future months and future log dates
are rejected. Historical overviews use the selected month's last day; today's
card is null when viewing a historical month.

Example POST `/meter-readings` for an end-of-day cumulative meter counter:

```json
{"date": "2026-11-22", "meter_reading_kwh": 12345.6}
```

Alternatively, provide a known daily consumption total:

```json
{"date": "2026-11-22", "consumption_kwh": 5.3}
```

PUT accepts the same body without `date`. Supply exactly one kWh field. One row
per household/date is retained; replacement returns 200, creation returns 201.
The returned `item` includes raw input and `daily_usage_kwh`. Input accepts zero
and up to three decimal places. Dates must be between 2000-01-01 and today.

Cumulative readings must be nondecreasing relative to adjacent cumulative logs.
Usage for date D is counter(D) minus counter(D-1), representing that day's usage.
A first counter is only a baseline. Missing consecutive counters produce null
usage, not an invented daily value. Backfilling or removing readings automatically
changes the derived usage on subsequent dates. No meter replacement/rollover
workflow is implemented. Direct daily totals are used exactly as entered.

Solar PUT body:

```json
{"generation_kwh": 8.4, "self_consumed_kwh": 5.2}
```

`self_consumed_kwh` is optional, cannot exceed generation, and is needed to
estimate avoided grid cost. Savings = self-consumed kWh times the selected rate;
generation alone does not establish savings or export credits. Missing solar
logs return null values and source `unavailable`. Solar is not subtracted again
from grid-meter consumption. Hardware integrations are not implemented.

Overview response groups:

- `usage`: today's/as-of-day kWh, known monthly kWh, daily/monthly allowances,
  percentage used, logged days, elapsed days, and data coverage.
- `budget`: known consumption cost, remaining budget, projected bill, status,
  days left, and safe daily spend. Projection uses average recorded daily usage
  times the calendar month's length. Missing days are never counted as zero.
  Days left includes today only when today's usage is unrecorded; it is zero for
  historical months. Safe spend is null when no consumption is known or no days
  remain. It does not account for unrecorded consumption on past days.
- `solar`: today's/as-of-day generation, estimated self-consumption savings, source.
- `chart`: dated buckets with kWh (null if absent), limits, logged/expected days,
  coverage, and over-limit status. With partial coverage, a below-limit result
  is unknown. Limits use the selected month's budget/rate, including across
  historical chart buckets; monthly buckets use its monthly kWh allowance.
- `appliance_breakdown`: current manual appliance estimates and percentage shares,
  sorted by estimated consumption; these are not measured appliance consumption.
- `alerts` / `alert_count`: top three saved active alerts and total count.
  `/dashboard/alerts` returns all saved active alerts for the month. Read state,
  rule toggles, refresh behavior, and event history are documented in Alerts API
  above. No background scheduler or external notification delivery is implemented.

When a plan is saved for the selected month, its budget and rate are used and
`settings_source` is `saved_budget_plan`. `saved_plan_is_stale` flags changed source
data. Otherwise household settings are used. Appliance breakdowns always use
current original appliance hours, not recommended plan hours. Costs exclude fixed
charges, taxes, time-of-use prices, and export credits. No-data amounts are null;
zero-budget percentage fields are null to avoid division by zero.

The `d615c9e270ab` migration adds `meter_readings` and `solar_generation`.

## Budget Planner API

Base path: `/api/households/<household_id>/budget-planner`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | base path | Household defaults, generated preview, available styles, saved plan |
| POST | `/generate` | Generate or recalculate an unsaved plan |
| PUT | `/plan` | Recalculate and save/replace the household's plan for that month |
| DELETE | `/plan?month=2026-11` | Remove that month's saved plan; returns 204 |

GET also accepts `?month=YYYY-MM`. Without a month, the current Manila calendar
month is used. An empty JSON object is valid for generation or saving and uses
the household's budget/rate and balanced mode. POST and PUT accept the same body:

```json
{
  "month": "2026-11",
  "monthly_budget": 2000,
  "electricity_rate": 12,
  "style": "balanced",
  "adjustments": [
    {"appliance_id": 3, "hours_per_day": 2.5}
  ]
}
```

Budget and rate are optional overrides for this plan, not updates to household
settings. Rate must be positive. Budget may be zero. Each adjustment must identify
an appliance in the household; duplicate IDs and changing must-have hours are
rejected. Adjustments allow 0-24 hours with up to three decimal places. To retain
all displayed hours after clicking +/- multiple times, send all displayed rows as
adjustments. Omitted rows are regenerated from the appliance baseline.

Generation returns `{"plan": {...}}`. A plan includes:

- `month`, `days_in_month`, `style`, `monthly_budget`, `electricity_rate`.
- `allowance`: `monthly_kwh`, `daily_kwh`, `daily_budget`.
- `items`: appliance ID, name/type, per-unit watts, quantity, must-have flag,
  original/recommended hours, `is_reduced`, and estimated daily/monthly kWh/cost.
- `totals`: daily/monthly consumption, monthly cost, original monthly cost,
  estimated savings, remaining budget, amount over budget, must-have monthly cost.
- `fits_budget`, `status` (`fits_budget` or `over_budget`), `warnings`, `tips`.

Style rules:

- `balanced`: keep baseline usage when affordable; otherwise trim flexible
  appliances with the highest combined watts (watts times quantity) first.
- `strict`: use the same trim order with a target of 90% of the budget, while
  always keeping must-have hours even if the buffer cannot be achieved.
- `comfort`: proportionally reduce all flexible hours to share the remaining
  budget after must-have usage.

Automatic recommendations never increase original hours. Reduced hours are
rounded down to 0.001 hour so rounding does not push a fitting plan over budget.
Manual adjustments are applied after generation, recalculate totals, and may
exceed the budget; the backend reports that rather than silently trimming them.
If must-have usage alone exceeds the budget, flexible hours become zero and the
plan reports the unavoidable overrun. Empty households return an empty plan and
a warning. Tips are general advice without invented savings percentages or
assumptions about solar equipment or time-of-use tariffs.

PUT returns `{"saved_plan": {"id": ..., "household_id": ..., "created_at": ...,
"updated_at": ..., "is_stale": false, "plan": {...}}}`. GET's `saved_plan` has
the same structure, or null if nothing is saved. Saved results are snapshots;
`is_stale` flags changes to the source appliances or household settings since
saving. Regenerate and save to refresh. Over-budget plans can be saved, retaining
their warnings. Saving never changes appliance hours or household settings.

For an unsaved Reset action, use GET's `defaults` and `preview`. DELETE explicitly
clears a saved plan only; it never removes appliances. No frontend changes are
included in this backend feature.

The `c942a7b18e50` migration creates `budget_plans`, with one row per household
and month. Apply it before loading or saving the planner:

```powershell
flask --app backend/app.py db upgrade
```

## Start locally

From the repository root:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
flask --app backend/app.py db upgrade
python backend/app.py
```

Set `DATABASE_URL` in `backend/.env` to your PostgreSQL connection URL. Plain
PostgreSQL URLs use the installed psycopg driver. `CORS_ORIGINS` defaults to
`http://localhost:5173`. No database URL or password belongs in frontend code.

In another terminal, run `npm run dev` from `frontend/`. Open
`http://localhost:5173/appliances`; Vite proxies `/api` requests to Flask on port
5000. The production frontend requires the same `/api` reverse proxy.

## Household setup

The appliance page loads `GET /api/households` and remembers the selected
household in local storage. When the database has no households, it shows a setup
form that calls `POST /api/households`:

```json
{"name": "My home", "electricity_rate": 12, "monthly_budget": 2000}
```

Both endpoints return records with `id`, `name`, `electricity_rate`, and
`monthly_budget`. Lists use `{"items": [...]}`; creation uses `{"item": {...}}`.
The rate is PHP/kWh, and the budget is PHP. Rate must be positive; budget may be zero.

## Manual appliances

Base path: `/api/households/<household_id>/appliances`.

- `GET`: list appliances, filter counts, and household estimate totals.
- `POST`: create an appliance, returning HTTP 201.
- `GET /<appliance_id>`: retrieve an appliance.
- `PATCH /<appliance_id>`: update provided fields.
- `DELETE /<appliance_id>`: remove an appliance, returning HTTP 204 with no body.

Example POST body:

```json
{
  "name": "Bedroom aircon",
  "appliance_type": "aircon",
  "watts": 900,
  "quantity": 1,
  "hours_per_day": 4,
  "is_must_have": false
}
```

Required: `name`, `watts`, `hours_per_day`. Quantity defaults to 1 and must be a
positive integer; hours must be between 0 and 24. Watts and hours accept up to
three decimal places. Optional `room` and `appliance_type` accept null. PATCH
cannot move an appliance to another household.

The frontend API adapter translates `type`, `hoursPerDay`, and `isMustHave` to
backend field names. Saved cards use the returned `estimated_monthly_kwh` and
`estimated_monthly_cost`. The unsaved preview uses the returned household rate
and month length. Lists support `category=all|must-have|flexible`; estimates
support `month=YYYY-MM`, defaulting to the current month in Asia/Manila.

Daily kWh = watts * quantity * hours / 1000. Monthly consumption multiplies by
the selected month's day count. Cost multiplies by the household rate. List
totals cover the entire household even with a category filter. Estimates are
projections from manual inputs, not historical readings, and exclude fixed
charges. Camera scanning and automatic efficiency labels are not implemented.

Invalid requests return HTTP 400 with `{"error": "..."}`. Missing resources
return 404. Database failures return a generic JSON error and roll back writes.
The UI retains form input and the delete dialog when a write fails.

## Code organization

- `app/__init__.py`: configuration, extensions, blueprint registration.
- `app/errors.py`: JSON request parsing and shared API error handlers.
- `blueprints/appliances/routes.py`: HTTP request/response handling.
- `blueprints/appliances/validation.py`: input validation.
- `blueprints/appliances/estimates.py`: calculations and serialization.
- `blueprints/appliances/services.py`: persistence and list summaries.
- `blueprints/households/`: household listing and setup.
- `models/`: SQLAlchemy typed models.
- `migrations/`: versioned schema changes.

These endpoints currently have no authentication. Household IDs scope queries;
they do not authorize access. Use this flow as a development setup until user
ownership is implemented.

After changing models, review the generated migration before applying it:

```powershell
flask --app backend/app.py db migrate -m "Describe schema change"
flask --app backend/app.py db upgrade
```

No schema changes are required for the frontend integration beyond the existing
`b781d9a4c203` appliance-fields migration.
