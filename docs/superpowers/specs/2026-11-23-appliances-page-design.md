# Appliances Page (manual entry) — Design

**Date:** 2026-11-23
**Project:** EnergyWise — SDG 7 energy power-saving assistant (24-hour hackathon)
**Scope:** Frontend only. First page of the app.
**Visual reference:** Figma file "EnergyWise – Power Saving Assistant (SDG 7)", frames `Desktop / Appliances` and `Mobile / Scan Appliance`.

## Why

Every other feature (budget plan, bill estimate, alerts, solar sizing) starts from knowing which appliances a household has, how much power each draws, and how long it runs. Without hardware, the user types this in. Later, a photo of the rating label (Google Vision) will fill the same form automatically, so the manual form is the foundation the camera feature plugs into.

## Goals

- User can **add** an appliance by typing: name, type, watts, hours per day, quantity, and whether it is a must-have.
- User can **see** all appliances as cards showing watts · hours/day, estimated monthly kWh, and monthly cost.
- User can **edit** and **delete** an appliance.
- User can **filter** the list: All / Must-have / Flexible.
- Page shows the **total kWh per day** across all appliances.
- Data **survives a page refresh** (browser storage).
- Code is **simple and readable**: small components, plain functions, no clever abstractions.

## Non-goals (for this step)

- Camera / Google Vision scanning (next step; the form is built so it can be pre-filled later).
- Flask backend for appliances (later; storage is hidden behind `api.js` so only that file changes).
- Other pages' content. Dashboard, Budget Planner, Solar, Alerts exist only as placeholder pages so the sidebar links work.
- "Inefficient" and "Standby power" tags from the Figma design. They need data we don't collect yet.
- Mobile bottom tab bar. On narrow screens the page simply stacks the form above the list.

## Anti-goals

- Code the frontend teammates can't read and explain to judges in a few minutes.
- A design that drifts from the Figma file (colors, spacing, card style).

## Approaches considered

**Where appliance data lives until the backend is ready**
1. **Browser storage (localStorage) behind `api.js` — chosen.** No backend dependency, works offline for the demo, and `api.js` keeps the same async function names a real API would use, so switching to Flask later changes one file.
2. Add `/api/appliances` to Flask now (in-memory like `/api/items`). Real API from day one, but touches the backend teammate's code and loses data on server restart.

**Styling**
1. **Tailwind CSS v4 — chosen** (user's call). Utility classes in the JSX, theme colors defined once from the Figma tokens. The starter project currently uses plain CSS, so Tailwind will be added.
2. Plain CSS files per component. No new tool, but more files and more naming to keep consistent.

**Components** (added after Task 1, user's call)
1. **shadcn/ui (Radix base) — chosen.** Accessible inputs, select, checkbox and confirm dialog out of the box; source lives in `src/components/ui/` so we can restyle it. Figma colors are mapped onto shadcn's standard theme variables, so there is one color system. Icons come from `lucide-react` (the same icon set used in Figma).
2. Hand-made Button/Card/Badge/Icon (built in Task 1). Fewer dependencies, but form controls and dialogs would need to be written by hand.

## Decided

- **Stack:** existing React 19 + Vite 7. Add `tailwindcss` + `@tailwindcss/vite` (v4) and `react-router-dom`.
- **Theme:** Figma tokens become Tailwind theme colors in `src/index.css` via `@theme`:
  - backgrounds `base #0A1020`, `surface #111A2E`, `raised #18233B`; border `#25324D`
  - text `#E8EEF8`, muted `#8B98B3`, on-accent `#04140D`
  - green `#22E39B` (+ soft `#0F3B2E`), yellow `#FACC15` (+ soft `#3A3212`), warning `#F59E0B` (+ soft `#3B2A0C`), danger `#F43F5E` (+ soft `#3D1220`), info `#38BDF8`
  - fonts: Space Grotesk (headings, numbers), DM Sans (body), loaded from Google Fonts in `index.html`
- **Electricity rate:** fixed `₱12.00 / kWh` constant for now (a settings input comes with the Budget Planner).
- **Appliance shape** (what gets saved):
  ```js
  { id, name, type, watts, hoursPerDay, quantity, isMustHave }
  ```
  `type` is one of: aircon, refrigerator, tv, fan, lights, other (drives the card icon).
- **Calculations** (in `src/utils/energy.js`, plain functions):
  - kWh per day = watts × quantity × hoursPerDay ÷ 1000
  - kWh per month = kWh per day × 30
  - cost per month = kWh per month × rate
- **Validation:** name required; watts > 0; hours per day 0–24; quantity ≥ 1. Errors shown under the field.
- **Folder structure:**
  ```
  frontend/src/
  ├── main.jsx
  ├── App.jsx                 routes + sidebar layout
  ├── api.js                  appliance functions (localStorage for now)
  ├── index.css               Tailwind import + theme tokens
  ├── lib/utils.js            shadcn's cn() helper
  ├── components/
  │   ├── Sidebar.jsx
  │   └── ui/                 shadcn components: button, card, badge, input,
  │                           label, select, checkbox, alert-dialog
  ├── pages/
  │   ├── Appliances/
  │   │   ├── AppliancesPage.jsx
  │   │   ├── ApplianceForm.jsx
  │   │   ├── ApplianceList.jsx
  │   │   └── ApplianceCard.jsx
  │   └── Placeholder.jsx     "Coming soon" page for the other sidebar links
  └── utils/
      └── energy.js
  ```
- **Layout (desktop):** sidebar (260px) | main area with header "Appliances" + subtitle; below it the form card (~400px) on the left and the list on the right, matching the Figma frame. The left panel shows the form in place of the camera preview for now; a disabled "Scan appliance (coming soon)" button marks where the camera goes.
- **Edit flow:** clicking Edit on a card loads it into the same form (title changes to "Edit appliance", button to "Save changes", plus Cancel).

## Left to the builder

- Exact Tailwind class choices, as long as the result matches the Figma frame.
- Empty state wording when there are no appliances.
- Delete asks for confirmation with a shadcn `AlertDialog`.
