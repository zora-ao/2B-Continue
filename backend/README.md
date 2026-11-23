# EnergyWise backend

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
