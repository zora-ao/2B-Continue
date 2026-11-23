# Kuryenta

**Know where your electricity money goes and how to spend less of it.**

Kuryenta is a household energy-saving web app built around **SDG 7: Affordable and Clean Energy**. You enter your appliances, budget and meter readings. Kuryenta then shows what each appliance costs, builds a monthly plan that fits your budget, warns you before the bill gets out of hand, and helps you decide whether solar panels are worth it.

`React 19` · `Vite 7` · `Tailwind CSS v4` · `shadcn/ui` · `Flask 3` · `SQLAlchemy 2` · `PostgreSQL (Supabase)` · `Vercel` · `Render`

[Features](#features) · [How it works](#how-it-works) · [Getting started](#getting-started) · [API](#api) · [Deployment](#deployment)

> [!IMPORTANT]
> Every number Kuryenta shows is an **estimate built from what you type in**: appliance wattage, hours of use, meter readings and your electricity rate. It is not connected to a smart meter or to your utility. Solar prices and sun-hours are indicative values, not quotes.

---

## Contents

- [Why Kuryenta](#why-kuryenta)
- [Features](#features)
- [How it works](#how-it-works)
- [The math](#the-math)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Commands](#commands)
- [API](#api)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Contributing](#contributing)

---

## Why Kuryenta

Most households only find out what they used when the bill arrives, and by then it's too late to change anything. The bill also doesn't say *which* appliance caused it.

Kuryenta moves that moment earlier:

- **Before the month:** plan how many hours each appliance can run and still stay within budget.
- **During the month:** log meter readings and see right away whether you're on track.
- **When something goes wrong:** get an alert about a usage spike, a day over the limit, or a projected bill above budget.
- **For the long term:** see which solar system size fits your usage and budget, and how long it would take to pay for itself.

---

## Features

| Page | What you can do |
| --- | --- |
| **Dashboard** | See today's usage, the month's spend against your budget, the projected bill, a safe daily spend, a usage chart (day / week / month), the share each appliance takes, and your top alerts. Log meter readings here. |
| **Budget Planner** | Enter a monthly budget and pick a style (**Balanced**, **Strict** or **Comfort**). Kuryenta suggests hours per appliance so the plan fits. Adjust any row with +/- and save the plan for the month. |
| **Appliances** | Add, edit and delete appliances (watts, quantity, hours per day, room, must-have or flexible). Each card shows its estimated monthly kWh and cost. |
| **Solar** | Compare 1, 2 and 3 kW systems by cost, monthly savings and payback time, with the best fit highlighted. If you already have panels, log daily generation and compare it with the expected output based on that day's weather. |
| **Alerts** | Review budget, usage, appliance and solar alerts. Filter them, mark them read or unread, and switch each rule on or off. |

All pages work per **household**. On first visit you create one (name, electricity rate in PHP/kWh, monthly budget), and the app remembers which one you picked.

---

## How it works

| Step | You | Kuryenta |
| --- | --- | --- |
| **1 · Set up** | Create a household with your rate and budget. | Saves it and remembers your selection in the browser. |
| **2 · List appliances** | Add each appliance with its watts and daily hours. | Estimates daily and monthly kWh and cost for each one. |
| **3 · Plan** | Choose a budget style and fine-tune the hours. | Trims flexible appliances (never must-haves) until the plan fits, then saves it for the month. |
| **4 · Track** | Log your meter reading, or the day's kWh, each day. | Updates usage, the projected bill, the safe daily spend and the chart. |
| **5 · React** | Read the alerts. | Flags days over the limit, usage spikes, a projected bill above budget, costly appliances and weak solar days. |
| **6 · Go solar (optional)** | Enter your location and install budget. | Recommends a system size; after install, compares actual and expected generation. |

---

## The math

The formulas are kept simple on purpose, so every number can be checked by hand.

**Appliance cost**

```
daily_kwh    = watts × quantity × hours_per_day / 1000
monthly_kwh  = daily_kwh × days in the month
monthly_cost = monthly_kwh × electricity rate (PHP/kWh)
```

> Example: a 900 W aircon running 4 h a day → 3.6 kWh/day → 108 kWh in a 30-day month → **PHP 1,296** at PHP 12/kWh.

**Budget planner styles**

| Style | Rule |
| --- | --- |
| Balanced | Keep your hours if they fit. If not, cut the most power-hungry flexible appliances first. |
| Strict | Same order, but aim for **90%** of the budget to leave a buffer. |
| Comfort | Reduce every flexible appliance by the same proportion, so no single one is cut hard. |

Must-have appliances are never reduced. If they alone exceed the budget, the plan says so instead of hiding it.

**Projected bill:** the average of the days you logged × the days in the month × your rate. Days with no log are left out; they are **not** counted as zero.

**Alerts**

| Alert | Fires when |
| --- | --- |
| Daily limit | A day's usage is above budget ÷ rate ÷ days in the month |
| Bill over budget | The projected bill is above the budget |
| Unusual spike | A day is more than **115%** of the average of the previous 7 logged days (at least 3 needed) |
| Wasteful appliances | An appliance has the highest estimated use, or wastes power on standby |
| Solar underperforming | A finished day produced below **70%** of the expected output |
| Weekly summary | A recap for each finished week |

**Solar**

```
monthly_generation = system kW × sun-hours × 30.4 days × 0.80 performance ratio
expected_daily     = system kW × that day's peak sun hours (Open-Meteo) × 0.80
payback_years      = system cost ÷ (monthly savings × 12)
```

The **best fit** is the smallest system within your budget that covers at least 95% of your usage.

---

## Architecture

```
 Browser (React SPA)
        │   /api/*  (Vite proxy in dev · Vercel rewrite in production)
        ▼
 Flask API  ── blueprints: households · appliances · budget-planner · dashboard · solar · alerts
        │                         │
        ▼                         ▼
 PostgreSQL (Supabase)      Open-Meteo (place search, yearly sunlight, daily solar output)
```

Rules the codebase follows:

- **The frontend only talks to `/api`.** It never connects to the database, and no database URL or password goes in frontend code.
- **`src/api.js` is the only place** that converts the API's `snake_case` to the frontend's `camelCase`.
- **Each backend feature is a blueprint** with the same structure: `routes.py` (HTTP), `validation.py` (input checks), `calculations.py` (pure math) and `services.py` (database).
- **Schema changes go through migrations** (Flask-Migrate / Alembic). Never edit the database by hand.
- **All dates use Asia/Manila time** for "today" and "this month".

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite 7, React Router 7, plain JavaScript |
| Styling | Tailwind CSS v4, shadcn/ui (Radix), lucide-react icons |
| Backend | Flask 3, Flask-CORS, Flask-SQLAlchemy, SQLAlchemy 2 |
| Database | PostgreSQL on Supabase, psycopg 3, Flask-Migrate (Alembic) |
| Weather | Open-Meteo (free, no API key) |
| Hosting | Frontend on **Vercel**, API on **Render** (gunicorn) |

---

## Repository layout

```
frontend/                 React app
  src/
    pages/                One folder per page: Dashboard, Budget, Appliances, Solar, Alerts
    components/           Sidebar, PageHeader, HouseholdPicker
    components/ui/        shadcn/ui components (button, card, select, …)
    hooks/                useHouseholds
    lib/                  Formatting and helper functions per feature
    api.js                The single fetch wrapper for /api
  vite.config.js          Dev server on :5173, proxies /api to Flask on :5000
  vercel.json             Production rewrites (/api → Render)

backend/                  Flask API
  app.py                  Entry point
  app/
    __init__.py           create_app(): config, CORS, blueprint registration
    errors.py             JSON parsing and shared error handlers
    models/               SQLAlchemy models (household, appliance, budget_plan, energy_log, solar_profile, alert)
    blueprints/           One folder per feature (see Architecture)
  migrations/             Versioned database schema changes
  requirements.txt
  .env.example            Template for backend/.env
  README.md               Detailed API reference

render.yaml               Render blueprint for the API
CLAUDE.md                 Coding rules for this repo
```

---

## Getting started

### Prerequisites

- **Python 3.12+**
- **Node.js 20+** and npm
- A **PostgreSQL** database: the team's Supabase project, or your own

### 1 · Backend (terminal 1)

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
copy backend\.env.example backend\.env
```

Open `backend/.env` and set `DATABASE_URL` to your PostgreSQL connection string (replace `[YOUR-DATABASE-PASSWORD]`). Then:

```powershell
flask --app backend/app.py db upgrade    # create / update the tables
python backend/app.py                    # API on http://127.0.0.1:5000
```

Check that the API is running: http://127.0.0.1:5000/api/health should return `{"status": "ok"}`.

### 2 · Frontend (terminal 2)

```powershell
cd frontend
npm install
npm run dev                              # app on http://localhost:5173
```

Open **http://localhost:5173**. Requests to `/api/*` are forwarded to Flask automatically.

### Next time

You only need:

```powershell
.\.venv\Scripts\Activate.ps1; python backend/app.py     # terminal 1
cd frontend; npm run dev                                 # terminal 2
```

> [!WARNING]
> The backend on port 5000 uses the **live Supabase data**. To test frontend changes without touching it, run a throwaway backend on another port and point Vite at it:
> `$env:API_URL="http://127.0.0.1:5001"; npx vite`

### Environment variables (`backend/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | none (required) | PostgreSQL connection string |
| `PORT` | `5000` | Port for the Flask dev server |
| `FLASK_DEBUG` | `1` | `1` = auto-reload and debug errors; use `0` in production |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `DATABASE_URL environment variable is not set` | `backend/.env` is missing or the line is empty. |
| PowerShell won't run `Activate.ps1` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| Errors about missing tables or columns | Run `flask --app backend/app.py db upgrade` again, especially after pulling. |
| Frontend shows network errors | Make sure the backend is running on port 5000. |

---

## Commands

| Command | Where | What it does |
| --- | --- | --- |
| `npm run dev` | `frontend/` | Start the dev server with hot reload |
| `npm run build` | `frontend/` | Build the production bundle into `dist/` |
| `npm run preview` | `frontend/` | Serve the production build locally |
| `python backend/app.py` | root | Start the Flask API |
| `flask --app backend/app.py db upgrade` | root | Apply all pending migrations |
| `flask --app backend/app.py db migrate -m "message"` | root | Generate a migration after changing a model (review it before applying) |

---

## API

All endpoints live under `/api`. Each feature is scoped to one household: `/api/households/<id>/…`.

| Area | Base path | Main endpoints |
| --- | --- | --- |
| Health | `/api/health` | `GET` |
| Households | `/api/households` | `GET` list, `POST` create |
| Appliances | `…/<id>/appliances` | `GET`, `POST`, `GET/PATCH/DELETE /<appliance_id>` |
| Budget Planner | `…/<id>/budget-planner` | `GET`, `POST /generate`, `PUT /plan`, `DELETE /plan` |
| Dashboard | `…/<id>/dashboard` | `GET`, `GET /alerts`, meter readings and solar generation (`GET/POST/PUT/DELETE`) |
| Solar | `…/<id>/solar` | `GET`, `GET /recommendations`, `GET /performance`, `GET /places?q=`, `GET/PUT /profile`, readings |
| Alerts | `…/<id>/alerts` | `GET`, `GET/PATCH /rules`, `POST /refresh`, `PATCH /<alert_id>`, `POST /mark-all-read` |

Most `GET` endpoints accept `?month=YYYY-MM` (default: the current month in Manila time).

**Errors:** invalid input returns `400` with `{"error": "..."}`, a missing record returns `404`, and database failures return a generic error and roll back the change.

📖 Every endpoint, with request bodies, response fields and the exact rules, is documented in **[backend/README.md](backend/README.md)**.

---

## Deployment

| Target | How |
| --- | --- |
| **API** | Render reads [`render.yaml`](render.yaml): *New → Blueprint →* pick this repo. It asks for `DATABASE_URL` once. Use Supabase's **Session pooler** connection string, because Render can't reach the direct IPv6 address. On each deploy it runs `db upgrade` and then starts gunicorn. Health check: `/api/health`. |
| **Frontend** | Vercel, with `frontend/` as the project root. [`vercel.json`](frontend/vercel.json) forwards `/api/*` to the Render API and sends every other path to `index.html` so page refreshes work. |
| **Database** | Add a model change, run `db migrate`, review the file, commit it. Render applies it on the next deploy. Never edit a migration that's already been applied. |

Add the Vercel URL to `CORS_ORIGINS` on Render if the frontend calls the API directly.

---

## Known limitations

- **No login yet.** Anyone with the URL can see every household. Household IDs separate the data but do not protect it.
- **Manual data only.** No smart-meter or utility integration; appliance figures are estimates from the values you enter.
- **Simple pricing.** Bills exclude fixed charges, taxes, time-of-use rates and solar export credits.
- **No background jobs.** Alerts are evaluated when data changes or when you refresh; nothing is sent by email or push.
- **Indicative solar data.** System prices in `backend/app/blueprints/solar/catalog.py` are estimates, not supplier quotes. Sun-hours are your place's 12-month average from Open-Meteo, or 4.5 when that's unavailable.

---

## Contributing

- **Branching:** branch from an up-to-date `main` as `feat/<area>/<topic>` (for example `feat/frontend/solar-page`), then open a short pull request with **Summary / Testing / Notes**.
- **Frontend:** plain JavaScript, no TypeScript. A new page follows the layout of `src/pages/Budget/`: a `<Name>Page.jsx` that owns the state, small components next to it, and helpers in `src/lib/`. Reuse the shadcn components in `src/components/ui/`.
- **Backend:** follow the blueprint structure (routes → validation → calculations → services). Every schema change needs a migration.
- **Before you open a PR:** run `npm run build` and check the page in the browser against a throwaway backend.

Read **[CLAUDE.md](CLAUDE.md)** for the full conventions before you start.

---

*Kuryenta is a student project supporting SDG 7: Affordable and Clean Energy.*
