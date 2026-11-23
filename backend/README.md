# EnergyWise backend

## Dashboard API

Base path: `/api/households/<household_id>/dashboard`. No frontend files were
changed for this feature.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | base path | Overview cards, budget, chart, appliance breakdown, top 3 alerts |
| GET | `/alerts` | All currently calculated dashboard alerts |
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
- `alerts` / `alert_count`: top three calculated alerts and total count. `/alerts`
  returns all. Alerts cover budget projection, latest logged usage over the limit,
  usage >15% above up to seven previous logged days (minimum three within 14 days),
  and the biggest estimated appliance cost. No solar-fault claims, saved read
  state, background monitoring, or external notification delivery are implemented.

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
