# Appliances Page (manual entry) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the EnergyWise Appliances page where a user types in appliances (watts, hours/day, quantity, must-have) and sees per-appliance monthly kWh and ₱ cost plus a daily total, saved in the browser.

**Architecture:** React pages under `src/pages/`, shared UI in `src/components/`, all math and form parsing as plain tested functions in `src/utils/`, and all storage behind async functions in `src/api.js` (localStorage now, Flask later). Tailwind v4 provides styling with the Figma tokens as theme colors.

**Tech Stack:** React 19, Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), react-router-dom 7, Vitest + jsdom (tests for `utils/` and `api.js`).

**Spec:** `docs/superpowers/specs/2026-11-23-appliances-page-design.md`

## Global Constraints

- All work in `frontend/`; run npm commands from `frontend/`. Do not touch `backend/`.
- Keep the existing `api.health`, `api.listItems`, `api.createItem` in `api.js` working.
- Code must be simple and readable: plain functions, small components, no state libraries, no TypeScript.
- Theme colors (exact hex): base `#0A1020`, surface `#111A2E`, raised `#18233B`, border `#25324D`, text `#E8EEF8`, muted `#8B98B3`, on-accent `#04140D`, green `#22E39B`, green-soft `#0F3B2E`, yellow `#FACC15`, yellow-soft `#3A3212`, warning `#F59E0B`, warning-soft `#3B2A0C`, danger `#F43F5E`, danger-soft `#3D1220`, info `#38BDF8`.
- Fonts: Space Grotesk (headings, numbers), DM Sans (body), from Google Fonts.
- Rate `₱12.00 / kWh`; month = 30 days.
- Appliance shape: `{ id, name, type, watts, hoursPerDay, quantity, isMustHave }`; `type` ∈ `aircon | refrigerator | tv | fan | lights | other`.
- Validation: name required; watts > 0; hours per day 0–24; quantity ≥ 1.
- localStorage key: `energywise.appliances`.

## Review Focus

1. **Corrupted or missing browser storage** (empty, or not valid JSON): the page shows an empty list instead of crashing. → test in Task 3.
2. **Form values arrive as strings** (`"900"`, `"2.5"`): they are saved as numbers so the math isn't string concatenation. → test in Task 2.
3. **Edge hours** `0`, `24`, and `2.5` are accepted; `24.5`, `-1` and blank are rejected. Quantity `1.5` is rejected. → tests in Task 2.
4. **Editing** keeps the same `id` and does not add a duplicate. → test in Task 3.
5. **Money and kWh formatting** uses thousands separators and no float noise (`₱1,296`, not `₱1296.0000001`). → tests in Task 2.

---

### Task 1: Tailwind, theme, routing, and app shell with sidebar

**Files:**
- Modify: `frontend/package.json` (deps + `"test": "vitest run"` script)
- Modify: `frontend/vite.config.js` (add `tailwindcss()` plugin; add `test: { environment: "node" }`)
- Modify: `frontend/index.html` (Google Fonts link for Space Grotesk 500/700 and DM Sans 400/500/600; `<title>EnergyWise</title>`)
- Replace: `frontend/src/index.css` (`@import "tailwindcss";` + `@theme` block + `body` base styles)
- Modify: `frontend/src/main.jsx` (wrap `<App />` in `<BrowserRouter>`)
- Replace: `frontend/src/App.jsx` (layout + routes)
- Create: `frontend/src/components/Icon.jsx`, `Button.jsx`, `Card.jsx`, `Badge.jsx`, `Sidebar.jsx`
- Create: `frontend/src/pages/Placeholder.jsx`

**Interfaces:**
- Produces:
  - Theme tokens usable as Tailwind classes: `bg-base`, `bg-surface`, `bg-raised`, `border-line`, `text-ink`, `text-muted`, `text-on-accent`, `bg-green`/`text-green`, `bg-green-soft`, same pattern for `yellow`, `warning`, `danger`, plus `text-info`; fonts `font-display` (Space Grotesk) and `font-body` (DM Sans).
  - `<Icon name size? className? />`. `name` ∈ `zap, dashboard, wallet, plug, sun, bell, camera, plus, check, lock, edit, trash, aircon, refrigerator, tv, fan, lights, other`. Inline 24×24 lucide SVG, `stroke="currentColor"` (color comes from `className`). Use the lucide paths from the Figma file; `other` = plug icon.
  - `<Button variant="primary"|"secondary" icon? type? disabled? onClick? className?>children</Button>`
  - `<Card className?>children</Card>`: surface background, border, rounded-2xl, padding 24px.
  - `<Badge tone="green"|"warning"|"danger"|"yellow">children</Badge>`: uppercase pill.
  - Routes: `/` → Placeholder "Dashboard", `/budget` → "Budget Planner", `/appliances` → AppliancesPage (temporary Placeholder until Task 5), `/solar` → "Solar", `/alerts` → "Alerts".
  - `<Placeholder title />`: shows the title and "Coming soon".

- [ ] **Step 1: Install packages**

Run: `npm install react-router-dom && npm install -D tailwindcss @tailwindcss/vite vitest jsdom`
Expected: installs without errors; `package.json` lists them.

- [ ] **Step 2: Set up Tailwind, theme, fonts, router, shared components, Sidebar and Placeholder routes as listed above**

Sidebar matches the Figma `Sidebar` frame: 260px wide, `bg-surface`, right border, logo tile (green square with zap icon) + "EnergyWise", nav links using `NavLink` (active = `bg-green-soft text-green`), and the green-soft "SDG 7" card pinned to the bottom. Main area `bg-base`, padding 32px.

- [ ] **Step 3: Verify build and look**

Run: `npm run build`
Expected: build succeeds with no errors.
Run: `npm run dev`, open http://localhost:5173. Expected: dark page, sidebar with 5 links, clicking each shows its title + "Coming soon", active link highlighted green, fonts are Space Grotesk / DM Sans.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/src
git commit -m "feat(frontend): add Tailwind theme, router, and sidebar layout"
```

---

### Task 2: Energy math, formatting, and form parsing (tested)

**Files:**
- Create: `frontend/src/utils/energy.js`
- Create: `frontend/src/utils/applianceForm.js`
- Test: `frontend/src/utils/energy.test.js`, `frontend/src/utils/applianceForm.test.js`

**Interfaces:**
- Produces (`energy.js`):
  - `RATE_PER_KWH = 12`, `DAYS_PER_MONTH = 30`
  - `APPLIANCE_TYPES`: array of `{ value, label }` for `aircon "Aircon"`, `refrigerator "Refrigerator"`, `tv "Television"`, `fan "Electric fan"`, `lights "Lights"`, `other "Other"`
  - `dailyKwh(appliance) -> number`: `watts * quantity * hoursPerDay / 1000`
  - `monthlyKwh(appliance) -> number`: `dailyKwh * DAYS_PER_MONTH`
  - `monthlyCost(appliance, rate = RATE_PER_KWH) -> number`
  - `totalDailyKwh(appliances) -> number`
  - `formatKwh(n) -> string`: rounded to 1 decimal, trailing `.0` dropped, thousands separators, suffix `" kWh"`
  - `formatPeso(n) -> string`: rounded to whole pesos, `"₱"` + thousands separators
- Produces (`applianceForm.js`):
  - `EMPTY_FORM = { name: "", type: "other", watts: "", hoursPerDay: "", quantity: "1", isMustHave: false }`
  - `parseApplianceForm(form) -> { appliance: object | null, errors: object }`: on success `errors` is `{}` and `appliance` has trimmed `name`, `type`, numeric `watts`/`hoursPerDay`/`quantity`, boolean `isMustHave` (no `id`). On failure `appliance` is `null` and `errors` maps field → message.
  - `applianceToForm(appliance) -> form`: numbers back to strings, for editing.
  - Error messages (exact): `name: "Name is required"`, `watts: "Watts must be more than 0"`, `hoursPerDay: "Hours must be between 0 and 24"`, `quantity: "Quantity must be a whole number, 1 or more"`.

- [ ] **Step 1: Write the failing tests**

```js
// energy.test.js
const aircon = { watts: 900, quantity: 1, hoursPerDay: 4 };
test("dailyKwh", () => expect(dailyKwh(aircon)).toBe(3.6));
test("monthlyKwh uses 30 days", () => expect(monthlyKwh(aircon)).toBeCloseTo(108));
test("monthlyCost at ₱12", () => expect(monthlyCost(aircon)).toBeCloseTo(1296));
test("quantity multiplies", () => expect(dailyKwh({ watts: 9, quantity: 5, hoursPerDay: 5 })).toBeCloseTo(0.225));
test("totalDailyKwh", () => expect(totalDailyKwh([aircon, { watts: 150, quantity: 1, hoursPerDay: 24 }])).toBeCloseTo(7.2));
test("totalDailyKwh of empty list is 0", () => expect(totalDailyKwh([])).toBe(0));
test("formatKwh", () => {
  expect(formatKwh(108)).toBe("108 kWh");
  expect(formatKwh(3.6000000004)).toBe("3.6 kWh");
  expect(formatKwh(1234.56)).toBe("1,234.6 kWh");
});
test("formatPeso", () => {
  expect(formatPeso(1296.0000001)).toBe("₱1,296");
  expect(formatPeso(80.6)).toBe("₱81");
  expect(formatPeso(0)).toBe("₱0");
});

// applianceForm.test.js
const valid = { name: "  Aircon ", type: "aircon", watts: "900", hoursPerDay: "2.5", quantity: "1", isMustHave: false };
test("valid form becomes numbers", () => {
  const { appliance, errors } = parseApplianceForm(valid);
  expect(errors).toEqual({});
  expect(appliance).toEqual({ name: "Aircon", type: "aircon", watts: 900, hoursPerDay: 2.5, quantity: 1, isMustHave: false });
});
test("hours 0 and 24 allowed", () => {
  expect(parseApplianceForm({ ...valid, hoursPerDay: "0" }).errors).toEqual({});
  expect(parseApplianceForm({ ...valid, hoursPerDay: "24" }).errors).toEqual({});
});
test.each(["24.5", "-1", ""])("hours %s rejected", (h) => {
  expect(parseApplianceForm({ ...valid, hoursPerDay: h }).errors.hoursPerDay).toBe("Hours must be between 0 and 24");
});
test("blank name rejected", () => expect(parseApplianceForm({ ...valid, name: "   " }).errors.name).toBe("Name is required"));
test.each(["0", "-5", "", "abc"])("watts %s rejected", (w) => {
  expect(parseApplianceForm({ ...valid, watts: w }).errors.watts).toBe("Watts must be more than 0");
});
test.each(["0", "1.5", ""])("quantity %s rejected", (q) => {
  expect(parseApplianceForm({ ...valid, quantity: q }).errors.quantity).toBe("Quantity must be a whole number, 1 or more");
});
test("invalid form returns null appliance", () => expect(parseApplianceForm({ ...valid, name: "" }).appliance).toBeNull());
test("applianceToForm round-trips", () => {
  const { appliance } = parseApplianceForm(valid);
  expect(parseApplianceForm(applianceToForm({ id: "x", ...appliance })).appliance).toEqual(appliance);
});
```

(Add the matching `import { … } from "./energy.js"` / `"./applianceForm.js"` and `import { test, expect } from "vitest"` lines.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `./energy.js` / `./applianceForm.js`.

- [ ] **Step 3: Implement `energy.js` and `applianceForm.js` with the interfaces above**

Use `toLocaleString("en-US", { maximumFractionDigits: … })` for formatting. Treat blank strings as invalid numbers (`""` must not become `0`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils
git commit -m "feat(frontend): add energy math and appliance form parsing"
```

---

### Task 3: Appliance storage in `api.js` (tested)

**Files:**
- Modify: `frontend/src/api.js`
- Test: `frontend/src/api.test.js` (first line `// @vitest-environment jsdom`)

**Interfaces:**
- Consumes: appliance object shape from Task 2 (`parseApplianceForm(...).appliance`).
- Produces (added to the existing `api` object, all `async`):
  - `api.listAppliances() -> Promise<Appliance[]>`: `[]` when storage is empty or not valid JSON / not an array.
  - `api.addAppliance(data) -> Promise<Appliance>`: returns `{ id, ...data }` with `id = crypto.randomUUID()`, appended and saved.
  - `api.updateAppliance(id, data) -> Promise<Appliance>`: replaces fields, keeps `id`.
  - `api.deleteAppliance(id) -> Promise<void>`
  - Storage key `"energywise.appliances"`. A short comment says these will switch to `request("/appliances", …)` when Flask is ready.

- [ ] **Step 1: Write the failing tests**

```js
beforeEach(() => localStorage.clear());
const fan = { name: "Fan", type: "fan", watts: 60, hoursPerDay: 8, quantity: 1, isMustHave: false };

test("empty storage lists []", async () => expect(await api.listAppliances()).toEqual([]));
test("corrupted storage lists []", async () => {
  localStorage.setItem("energywise.appliances", "{not json");
  expect(await api.listAppliances()).toEqual([]);
});
test("add then list", async () => {
  const saved = await api.addAppliance(fan);
  expect(saved.id).toBeTruthy();
  expect(await api.listAppliances()).toEqual([saved]);
});
test("update keeps id, no duplicate", async () => {
  const saved = await api.addAppliance(fan);
  await api.updateAppliance(saved.id, { ...fan, hoursPerDay: 4 });
  const list = await api.listAppliances();
  expect(list).toHaveLength(1);
  expect(list[0]).toEqual({ ...fan, hoursPerDay: 4, id: saved.id });
});
test("delete removes only that one", async () => {
  const a = await api.addAppliance(fan);
  const b = await api.addAppliance({ ...fan, name: "Fan 2" });
  await api.deleteAppliance(a.id);
  expect(await api.listAppliances()).toEqual([b]);
});
test("data survives a new read (persisted)", async () => {
  await api.addAppliance(fan);
  expect(JSON.parse(localStorage.getItem("energywise.appliances"))).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL, `api.listAppliances is not a function`.

- [ ] **Step 3: Implement the four functions plus small private `readAll()` / `writeAll(list)` helpers in `api.js`**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS (Task 2 tests included).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api.js frontend/src/api.test.js
git commit -m "feat(frontend): store appliances in browser storage via api.js"
```

---

### Task 4: Appliance card and list (filters + daily total)

**Files:**
- Create: `frontend/src/pages/Appliances/ApplianceCard.jsx`
- Create: `frontend/src/pages/Appliances/ApplianceList.jsx`

**Interfaces:**
- Consumes: `Card`, `Badge`, `Button`, `Icon` (Task 1); `monthlyKwh`, `monthlyCost`, `totalDailyKwh`, `formatKwh`, `formatPeso`, `APPLIANCE_TYPES` (Task 2).
- Produces:
  - `<ApplianceCard appliance onEdit={(appliance) => void} onDelete={(id) => void} />`: icon tile by `type`, name, `"900 W · 4 h/day"` (prefix `"5 × "` when quantity > 1), green `MUST-HAVE` badge when `isMustHave`, bottom row "Monthly estimate" + `"108 kWh · ₱1,296"`, small Edit and Delete icon buttons.
  - `<ApplianceList appliances onEdit onDelete />`: filter chips `All (n)`, `Must-have (n)`, `Flexible (n)` (local state, default All), right-aligned `"Total ≈ 6.9 kWh / day"` using `formatKwh(totalDailyKwh(...))`, 2-column grid of cards (1 column under 1024px). Empty state when the filtered list is empty: icon + "No appliances yet. Add your first one using the form." (for All) or "Nothing here for this filter." (other filters).

- [ ] **Step 1: Build both components to match the Figma `Desktop / Appliances` right column**

- [ ] **Step 2: Verify**

Run: `npm run build`
Expected: build succeeds. (Visual check happens in Task 5 once they're on the page.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Appliances
git commit -m "feat(frontend): add appliance card and list with filters"
```

---

### Task 5: Appliance form and the Appliances page

**Files:**
- Create: `frontend/src/pages/Appliances/ApplianceForm.jsx`
- Create: `frontend/src/pages/Appliances/AppliancesPage.jsx`
- Modify: `frontend/src/App.jsx` (route `/appliances` → `AppliancesPage`)

**Interfaces:**
- Consumes: `EMPTY_FORM`, `parseApplianceForm`, `applianceToForm`, `APPLIANCE_TYPES` (Task 2); `api.listAppliances/addAppliance/updateAppliance/deleteAppliance` (Task 3); `ApplianceList` (Task 4).
- Produces:
  - `<ApplianceForm editing={Appliance|null} onSubmit={(applianceData) => void} onCancel={() => void} />`: controlled inputs held in one `form` state object; fields: Name (text), Type (select from `APPLIANCE_TYPES`), Power (number, "W" suffix), Hours per day (number, step 0.5, "h" suffix), Quantity (number, step 1), Must-have checkbox with label "Must-have (never cut by the planner)". On submit calls `parseApplianceForm`; shows each error in `text-danger` under its field; on success calls `onSubmit(appliance)` and resets to `EMPTY_FORM`. Live preview line under the fields when valid: `"≈ 3.6 kWh/day · ₱1,296/month"`. Title "Add appliance" / "Edit appliance"; submit button "Save appliance" / "Save changes"; Cancel shown only when editing. When `editing` changes, load it with `applianceToForm`. Disabled secondary button at the top: camera icon + "Scan appliance (coming soon)".
  - `AppliancesPage`: header "Appliances" + subtitle "Type in your appliances to see how much each one costs."; loads list with `api.listAppliances()` in `useEffect`; holds `appliances` and `editing` state; add/update/delete call `api` then refresh the list; delete asks `window.confirm("Delete <name>?")`. Layout: form card 400px on the left, list on the right; stacks below 1024px.

- [ ] **Step 1: Build both components and wire the route**

- [ ] **Step 2: Run unit tests and build**

Run: `npm test && npm run build`
Expected: tests PASS, build succeeds.

- [ ] **Step 3: Manual check in the browser (http://localhost:5173/appliances)**

Expected, in order:
1. Empty state shows.
2. Submit blank form → three error messages (name, watts, hours) appear; nothing is added.
3. Add "Aircon", type aircon, 900 W, 4 h, qty 1 → card shows `900 W · 4 h/day` and `108 kWh · ₱1,296`; total shows `3.6 kWh / day`.
4. Add "Refrigerator", 150 W, 24 h, must-have ticked → MUST-HAVE badge; total `7.2 kWh / day`; Must-have chip count is 1.
5. Edit the aircon to 1 h → card updates to `27 kWh · ₱324`, still 2 cards.
6. Refresh the page → both appliances still there.
7. Delete the aircon (confirm) → 1 card left.
8. Narrow the window below 1024px → form stacks above the list, no horizontal scroll.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): add appliances page with manual entry form"
```
