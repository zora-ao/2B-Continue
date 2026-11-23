<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/kuryenta-logo-white.svg">
  <img src="docs/assets/kuryenta-logo-navy.svg" alt="Kuryenta" width="420">
</picture>

<h3>Alamin ang gastos bago dumating ang bill.</h3>

<p><i>Know the cost before the bill arrives.</i></p>

<p>Log meter readings, see what each appliance costs to run, plan your day against a peso budget,<br>and find out if solar fits your home, all before the bill arrives.</p>

<img alt="SDG 7: Clean Energy" src="https://img.shields.io/badge/SDG_7-Clean_Energy-FFC857?labelColor=151526">
<img alt="React 19" src="https://img.shields.io/badge/React-19-FFC857?logo=react&labelColor=151526">
<img alt="Vite 7" src="https://img.shields.io/badge/Vite-7-FFC857?logo=vite&labelColor=151526">
<img alt="Tailwind CSS v4" src="https://img.shields.io/badge/Tailwind_CSS-v4-FFC857?logo=tailwindcss&labelColor=151526">
<img alt="Flask 3" src="https://img.shields.io/badge/Flask-3-FFC857?logo=flask&labelColor=151526">
<img alt="Postgres on Supabase" src="https://img.shields.io/badge/Postgres-Supabase-FFC857?logo=supabase&labelColor=151526">
<img alt="Hosted on Vercel and Render" src="https://img.shields.io/badge/Hosting-Vercel_%2B_Render-FFC857?logo=vercel&labelColor=151526">

<p>
  <a href="#how-it-works">How it works</a> ·
  <a href="#features">Features</a> ·
  <a href="#getting-started">Getting started</a> ·
  <a href="#api">API</a> ·
  <a href="#deployment">Deployment</a>
</p>

</div>

> [!IMPORTANT]
> Every number Kuryenta shows is an **estimate built from what you type in**: appliance wattage, hours of use, meter readings and your electricity rate. It is not connected to a smart meter or to your utility. Solar prices and sun-hours are indicative values, not quotes.

---

## Contents

1. [Project name](#project-name)
2. [Theme and problem](#theme-and-problem)
3. [Features](#features)
4. [Live link](#live-link)
5. [Setup and installation](#setup-and-installation)
6. [Technology disclosure](#technology-disclosure)
7. [Team members](#team-members)
8. [Credits](#credits)

---

## Project name

**Kuryenta**: a web app that helps Filipino households track, understand and plan their electricity use against a peso budget, before the bill arrives.

> ***Kuryenta*** comes from ***kuryente*** (electricity) and ***kuwenta*** (to count, to compute).
> **Kuwentahin ang kuryente habang may oras pang mag-adjust.**
> *Count your electricity while there's still time to adjust.*

---

## Theme and problem

**Theme: SDG 7, Affordable and Clean Energy.** Kuryenta works on both halves of the goal: *affordable*, by helping households use less and stay within budget, and *clean*, by showing whether rooftop solar fits their home.

**The problem.** When the electricity bill comes in higher than expected, the household is left guessing what happened.

- *Was it the extra hours of aircon?*
- *What if we ran it one hour less each day? Would next month fit the budget?*
- *Would a solar setup match what we use and what we can afford?*

The bill only gives a total. It doesn't say which appliance caused it, and it arrives when the month is already over.

**Who it helps.** Households that pay their own electricity bill, especially families on a tight monthly budget who want to know *where* the money goes and *what to change*. Members of one household can share it, so the whole family sees the same numbers.

**How Kuryenta helps.** It answers those questions **while there's still time to adjust**:

- **Track:** log meter readings and see each day whether you're on track for your budget.
- **Understand:** see what each appliance costs to run, in kWh and in pesos.
- **Plan:** try different daily schedules against a peso budget before you commit to them.
- **Get warned:** receive an alert for a usage spike, a day over the limit, or a bill heading over budget.
- **Explore solar:** compare system sizes based on your usage, location and installation budget, and see how long each would take to pay for itself.

---

## Features

The main features to try, in the order we suggest:

| # | Feature | What to try |
| --- | --- | --- |
| 1 | **Instant start** | Open the app. You're signed in as a guest right away, with no form to fill in. Create an account later and everything you added comes with you. |
| 2 | **Household setup and sharing** | Create a household with your electricity rate (PHP/kWh) and monthly budget. Share it with family using an 8-digit PIN that expires after 60 seconds. |
| 3 | **Appliances + AI label scan** | Add appliances by hand, or **scan the rating label**: take a photo, or scan a QR code to use your phone's camera. AI fills in the name, type and watts for you to check. Each card shows its monthly kWh and cost. |
| 4 | **Dashboard** | Log a meter reading and see today's usage, spend against budget, projected bill, safe daily spend, a day / week / month chart, each appliance's share, and the top alerts. |
| 5 | **Budget Planner** | Pick **Balanced**, **Strict** or **Comfort**. Kuryenta suggests hours per appliance so the month fits the budget. Fine-tune with +/- and save the plan. |
| 6 | **Solar** | Search your town, set an install budget, and compare 1, 2 and 3 kW systems by cost, savings and payback, with the best fit highlighted. With panels installed, log daily output and compare it with what that day's weather should have produced. |
| 7 | **Alerts** | Review budget, usage, appliance and solar alerts. Filter them, mark them read, and switch each rule on or off. |
| 8 | **Light and dark mode** | Switch the theme from the sidebar. |

### How it works

| Step | You | Kuryenta |
| --- | --- | --- |
| **1 · Set up** | Create a household with your rate and budget. | Saves it to your account (or guest session). |
| **2 · List appliances** | Add each appliance, or scan its label. | Estimates daily and monthly kWh and cost for each one. |
| **3 · Plan** | Choose a budget style and fine-tune the hours. | Trims flexible appliances (never must-haves) until the plan fits, then saves it for the month. |
| **4 · Track** | Log your meter reading, or the day's kWh, each day. | Updates usage, the projected bill, the safe daily spend and the chart. |
| **5 · React** | Read the alerts. | Flags days over the limit, usage spikes, a projected bill above budget, costly appliances and weak solar days. |
| **6 · Go solar (optional)** | Enter your location and install budget. | Recommends a system size; after install, compares actual and expected generation. |

### The math

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

### Known limitations

- **Manual data only.** No smart-meter or utility integration; appliance figures are estimates from the values you enter.
- **AI scan is a suggestion.** The label scan fills in name, type and watts, but you confirm them before saving. It needs a `GEMINI_API_KEY` on the server.
- **Simple pricing.** Bills exclude fixed charges, taxes, time-of-use rates and solar export credits.
- **No background jobs.** Alerts are evaluated when data changes or when you refresh; nothing is sent by email or push.
- **Indicative solar data.** System prices in `backend/app/blueprints/solar/catalog.py` are estimates, not supplier quotes. Sun-hours are your place's 12-month average from Open-Meteo, or 4.5 when that's unavailable.

---

## Live link

| | Link |
| --- | --- |
| 🌐 Web app | https://kuryenta-101.vercel.app/appliances |
| ⚙️ API health check | https://twob-continue.onrender.com/api/health |

**Demo login: not needed.** Opening the app starts a guest session automatically. To test accounts and household sharing, click **Create account** in the sidebar.

> [!NOTE]
> The API runs on Render's free plan, which sleeps when idle. The **first load can take up to a minute** while it wakes up; after that it's fast.

---

<a id="getting-started"></a>

## Setup and installation

### Prerequisites

- **Python 3.12+**
- **Node.js 20+** and npm
- A **PostgreSQL** database: the team's Supabase project, or your own
- *Optional:* a **Google Gemini API key** for the appliance label scan

### Steps

**1. Clone the repository**

```powershell
git clone https://github.com/zora-ao/2B-Continue.git
cd 2B-Continue
```

**2. Set up the backend** (terminal 1, from the repository root)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt
copy backend\.env.example backend\.env
```

**3. Fill in `backend/.env`**: set `DATABASE_URL` (replace `[YOUR-DATABASE-PASSWORD]`) and `SECRET_KEY` (any long random string). Add `GEMINI_API_KEY` to turn on label scanning.

**4. Create the database tables and start the API**

```powershell
flask --app backend/app.py db upgrade    # create / update the tables
python backend/app.py                    # API on http://127.0.0.1:5000
```

Check it: http://127.0.0.1:5000/api/health should return `{"status": "ok"}`.

**5. Start the frontend** (terminal 2)

```powershell
cd frontend
npm install
npm run dev                              # app on http://localhost:5173
```

**6. Open http://localhost:5173.** Requests to `/api/*` are forwarded to Flask automatically.

**Next time**, you only need:

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
| `SECRET_KEY` | none (required) | Signs login tokens and household PINs; use a long random string |
| `GEMINI_API_KEY` | empty | Turns on the AI appliance label scan |
| `GEMINI_SCAN_MODEL` | `gemini-3.5-flash-lite` | Gemini model used for scanning |
| `PORT` | `5000` | Port for the Flask dev server |
| `FLASK_DEBUG` | `1` | `1` = auto-reload and debug errors; use `0` in production |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins |

### Commands

| Command | Where | What it does |
| --- | --- | --- |
| `npm run dev` | `frontend/` | Start the dev server with hot reload |
| `npm run build` | `frontend/` | Build the production bundle into `dist/` |
| `npm run preview` | `frontend/` | Serve the production build locally |
| `python backend/app.py` | root | Start the Flask API |
| `flask --app backend/app.py db upgrade` | root | Apply all pending migrations |
| `flask --app backend/app.py db migrate -m "message"` | root | Generate a migration after changing a model (review it before applying) |

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `DATABASE_URL` or `SECRET_KEY environment variable is not set` | `backend/.env` is missing or that line is empty. |
| PowerShell won't run `Activate.ps1` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once. |
| Errors about missing tables or columns | Run `flask --app backend/app.py db upgrade` again, especially after pulling. |
| "Appliance scanning is currently unavailable" | Add `GEMINI_API_KEY` to `backend/.env` and restart the API. |
| Frontend shows network errors | Make sure the backend is running on port 5000. |

### Deployment

| Target | How |
| --- | --- |
| **API** | Render reads [`render.yaml`](render.yaml): *New → Blueprint →* pick this repo. Set `DATABASE_URL`, `SECRET_KEY` and `GEMINI_API_KEY`. Use Supabase's **Session pooler** connection string, because Render can't reach the direct IPv6 address. On each deploy it runs `db upgrade` and then starts gunicorn. Health check: `/api/health`. |
| **Frontend** | Vercel, with `frontend/` as the project root. [`vercel.json`](frontend/vercel.json) forwards `/api/*` to the Render API and sends every other path to `index.html` so page refreshes work. |
| **Database** | Add a model change, run `db migrate`, review the file, commit it. Render applies it on the next deploy. Never edit a migration that's already been applied. |

---

## Technology disclosure

### Languages

| Language | Used for |
| --- | --- |
| JavaScript (JSX) | The whole frontend |
| Python 3.12 | The backend API, calculations and AI scan handling |
| SQL (PostgreSQL) | Data storage, through SQLAlchemy and migrations |
| HTML / CSS | Page shell and styling (through Tailwind) |

### Frameworks and libraries

| Name | Used for |
| --- | --- |
| [React 19](https://react.dev) | Building the user interface |
| [Vite 7](https://vite.dev) | Dev server and production build |
| [React Router 7](https://reactrouter.com) | Page navigation (Dashboard, Budget, Appliances, Solar, Alerts, Login) |
| [Tailwind CSS v4](https://tailwindcss.com) + [tw-animate-css](https://github.com/Wombosvideo/tw-animate-css) | Styling, light / dark theme and animations |
| [shadcn/ui](https://ui.shadcn.com) + [Radix UI](https://www.radix-ui.com) | Accessible buttons, dialogs, selects, switches and cards |
| [cmdk](https://cmdk.paco.me) | Searchable location picker on the Solar page |
| [lucide-react](https://lucide.dev) | Icons |
| [qrcode.react](https://github.com/zpao/qrcode.react) | QR code for scanning a label with your phone |
| [Flask 3](https://flask.palletsprojects.com) | Backend web API |
| [Flask-SQLAlchemy](https://flask-sqlalchemy.readthedocs.io) / [SQLAlchemy 2](https://www.sqlalchemy.org) | Database models and queries |
| [Flask-Migrate](https://flask-migrate.readthedocs.io) (Alembic) | Versioned database schema changes |
| [Flask-JWT-Extended](https://flask-jwt-extended.readthedocs.io) | Login sessions (secure cookies) for accounts and guests |
| [Flask-CORS](https://flask-cors.readthedocs.io) | Allowing the frontend's origin to call the API |
| [psycopg 3](https://www.psycopg.org) | PostgreSQL driver |
| [Pillow](https://python-pillow.org) | Checking and resizing uploaded label photos |
| [python-dotenv](https://github.com/theskumar/python-dotenv) | Loading `backend/.env` |
| [gunicorn](https://gunicorn.org) | Production web server on Render |

### APIs and services

| Service | Used for |
| --- | --- |
| [Supabase](https://supabase.com) (PostgreSQL) | Hosted database |
| [Open-Meteo](https://open-meteo.com) | Town search (geocoding), yearly sunlight and daily solar radiation for expected panel output. Free, no API key. |
| [Google Gemini API](https://ai.google.dev) | Reading appliance rating labels from photos |
| [Render](https://render.com) | Hosting the API |
| [Vercel](https://vercel.com) | Hosting the frontend |
| [Google Fonts](https://fonts.google.com) | DM Sans and Space Grotesk typefaces |

### Architecture

```
 Browser (React SPA)
        │   /api/*  (Vite proxy in dev · Vercel rewrite in production)
        ▼
 Flask API  ── blueprints: auth · households · appliances · scans · budget-planner · dashboard · solar · alerts
        │                    │                          │
        ▼                    ▼                          ▼
 PostgreSQL (Supabase)   Google Gemini (label scan)   Open-Meteo (place search, sunlight, daily solar output)
```

Rules the codebase follows:

- **The frontend only talks to `/api`.** It never connects to the database, and no database URL, password or API key goes in frontend code.
- **`src/api.js` is the only place** that converts the API's `snake_case` to the frontend's `camelCase`.
- **Each backend feature is a blueprint** with the same structure: `routes.py` (HTTP), `validation.py` (input checks), `calculations.py` (pure math) and `services.py` (database).
- **Schema changes go through migrations** (Flask-Migrate / Alembic). Never edit the database by hand.
- **All dates use Asia/Manila time** for "today" and "this month".

### Repository layout

```
frontend/                 React app
  src/
    pages/                One folder per page: Dashboard, Budget, Appliances, Solar, Alerts, Auth, Scan
    components/           Sidebar, household picker and sharing dialogs, logo, shared pieces
    components/ui/        shadcn/ui components (button, card, dialog, select, …)
    hooks/                useAuth, useHouseholds
    lib/                  Formatting and helper functions per feature
    api.js                The single fetch wrapper for /api
  vite.config.js          Dev server on :5173, proxies /api to Flask on :5000
  vercel.json             Production rewrites (/api → Render)

backend/                  Flask API
  app.py                  Entry point
  app/
    __init__.py           create_app(): config, CORS, JWT, blueprint registration
    errors.py             JSON parsing and shared error handlers
    models/               SQLAlchemy models
    blueprints/           One folder per feature (see Architecture)
  migrations/             Versioned database schema changes
  requirements.txt
  .env.example            Template for backend/.env
  README.md               Detailed API reference

docs/assets/              Kuryenta logo (navy and white)
render.yaml               Render blueprint for the API
CLAUDE.md                 Coding rules for this repo
```

### API

All endpoints live under `/api`. Household features are scoped to one household: `/api/households/<id>/…`.

| Area | Base path | Main endpoints |
| --- | --- | --- |
| Health | `/api/health` | `GET` |
| Auth | `/api/auth` | `POST /register`, `/login`, `/guest`, `/refresh`, `/logout`, `GET /me` |
| Households | `/api/households` | `GET` list, `POST` create, `DELETE /<id>`, `POST /<id>/invites`, `POST /join` |
| Appliances | `…/<id>/appliances` | `GET`, `POST`, `GET/PATCH/DELETE /<appliance_id>` |
| Label scan | `/api/scans`, `/api/scan-sessions` | `POST /scans/read`, `POST /scan-sessions`, `GET /scan-sessions/<code>`, `POST /scan-sessions/<code>/photo` |
| Budget Planner | `…/<id>/budget-planner` | `GET`, `POST /generate`, `PUT /plan`, `DELETE /plan` |
| Dashboard | `…/<id>/dashboard` | `GET`, `GET /alerts`, meter readings and solar generation (`GET/POST/PUT/DELETE`) |
| Solar | `…/<id>/solar` | `GET`, `GET /recommendations`, `GET /performance`, `GET /places?q=`, `GET/PUT /profile`, readings |
| Alerts | `…/<id>/alerts` | `GET`, `GET/PATCH /rules`, `POST /refresh`, `PATCH /<alert_id>`, `POST /mark-all-read` |

Most `GET` endpoints accept `?month=YYYY-MM` (default: the current month in Manila time). Invalid input returns `400` with `{"error": "..."}`, and a missing record returns `404`.

📖 Request bodies, response fields and the exact rules are in **[backend/README.md](backend/README.md)**.

### AI tools

| Tool | Used for |
| --- | --- |
| **Google Gemini** (`gemini-3.5-flash-lite`) | *Inside the app:* reads the appliance name, type and rated watts from a label photo. The user confirms every value before it's saved. |
| **Claude Code** (Anthropic) | *During development:* coding help, planning and design docs (`docs/superpowers/`), and writing this README. Every change was reviewed by the team. |
| **ChatGPT** (OpenAI) | *During development:* brainstorming ideas, research, and answering questions while building. |

---

## Team members

| Name | Role | GitHub |
| --- | --- | --- |
| Carl Jasper Ramos | TODO: Frontend | [@zora-ao](https://github.com/zora-ao) |
| Creon Perry Barcenas Talisic | TODO: Backend | [@creont28](https://github.com/creont28) |
| Mark Angelo Maloto | TODO: Concept & Documentation | [@markangelomaloto](https://github.com/markangelomaloto) |
| Jouhann Cadawas | TODO: Backend | [@Hojannn](https://github.com/Hojannn) |
| Rafael Pomique| TODO: Checker | [@leafexx](https://github.com/leafexx) |

### Contributing

- **Branching:** branch from an up-to-date `main` as `feat/<area>/<topic>` (for example `feat/frontend/solar-page`), then open a short pull request with **Summary / Testing / Notes**.
- **Frontend:** plain JavaScript, no TypeScript. A new page follows the layout of `src/pages/Budget/`: a `<Name>Page.jsx` that owns the state, small components next to it, and helpers in `src/lib/`. Reuse the shadcn components in `src/components/ui/`.
- **Backend:** follow the blueprint structure (routes → validation → calculations → services). Every schema change needs a migration.
- **Before you open a PR:** run `npm run build` and check the page in the browser against a throwaway backend.

Read **[CLAUDE.md](CLAUDE.md)** for the full conventions before you start.

---

## Credits

**Templates and UI components**

- [shadcn/ui](https://ui.shadcn.com): component templates in `frontend/src/components/ui/` (MIT)
- [Radix UI](https://www.radix-ui.com): accessible primitives behind those components (MIT)

**Assets**

- Kuryenta logo: designed by the team ([`docs/assets/`](docs/assets/))
- Icons: [Lucide](https://lucide.dev) (ISC)
- Fonts: [DM Sans](https://fonts.google.com/specimen/DM+Sans) and [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) from Google Fonts (SIL Open Font License)
- README badges: [Shields.io](https://shields.io)

**Datasets**

- Weather, solar radiation and geocoding data: [Open-Meteo](https://open-meteo.com), licensed [CC BY 4.0](https://open-meteo.com/en/license)
- Solar system prices and appliance default wattages: indicative estimates set by the team, not supplier or manufacturer data

---

*Kuryenta is a student project supporting SDG 7: Affordable and Clean Energy.*
