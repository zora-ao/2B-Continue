# 2B Continue

Boilerplate: **React (Vite)** frontend + **Flask** backend.

```
2B Continue/
├── backend/          Flask API (app factory + blueprint)
│   ├── app/
│   │   ├── __init__.py   create_app(), CORS, blueprint registration
│   │   └── routes.py     /api/health, /api/items
│   ├── run.py
│   ├── requirements.txt
│   └── .env.example
└── frontend/         React 19 + Vite 7
    ├── src/
    │   ├── App.jsx
    │   ├── api.js        fetch wrapper for /api
    │   └── main.jsx
    └── vite.config.js    proxies /api -> http://127.0.0.1:5000
```

## Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
python run.py
```

Runs on http://127.0.0.1:5000

## Frontend (in a second terminal)

```powershell
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — calls to `/api/*` are proxied to Flask.
