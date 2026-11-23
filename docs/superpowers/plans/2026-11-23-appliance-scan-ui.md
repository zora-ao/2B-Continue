# Appliance Scan UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users fill the Add appliance form from a photo of the rating label: upload, phone camera, or a desktop QR code handed off to a phone.

**Architecture:** Scan controls live inside the existing `ApplianceForm`. They pre-fill name, type and watts from the backend's vision AI result and never save on their own. A desktop QR dialog polls a short-lived scan session; a minimal `/scan/:code` page on the phone uploads the photo to it. All network calls go through `src/api.js`.

**Tech Stack:** React 19 + Vite, Tailwind v4, shadcn/ui (Radix), plain JavaScript, `qrcode.react`.

**Spec:** `docs/superpowers/specs/2026-11-23-appliance-scan-ui-design.md`

## Global Constraints

- Plain JavaScript only. No TypeScript, no tests, no React Query (project `CLAUDE.md`; this overrides the TDD steps in the sub-skills). Each task is verified with `npm run build` plus a browser check.
- Never point anything at the real backend on port 5000. Browser checks use the throwaway backend on port 5001 (`scratchpad/run_test_backend.py`), with fake scan endpoints added there. The fakes are never committed.
- Use the existing shadcn components and Tailwind tokens. Add new ones with the shadcn CLI (`npx shadcn@latest add dialog`).
- `src/api.js` is the only place that converts snake_case to camelCase.
- Run modern-web-guidance before each UI task (`forms`, `progress`/`spinner`, `accessibility`), and end the PR with its disclosure section.
- Appliance `type` values: `aircon, refrigerator, tv, fan, lights, other`.
- Work on branch `feat/frontend/appliance-scan` from an up-to-date `main`. Commits and PRs carry no AI attribution.

## Review Focus

1. **The user already typed something before scanning.** Only name, type and watts are replaced; hours/day, quantity and must-have stay. The status line says the form was filled.
2. **The QR dialog is closed mid-poll or the component unmounts.** Polling stops (abort plus clearing the timer), and nothing tries to set state afterwards.
3. **Large phone photos (8–12 MB, HEIC on iPhone).** `shrinkPhoto` outputs a JPEG of at most 1600 px. If `createImageBitmap` rejects the file, the user sees a friendly error, not a crash.
4. **Picking the same file twice.** The input's value is reset after each pick, so `change` fires again.
5. **A `/scan/:code` link that is expired or already used (410).** The phone shows the expired message, not a generic failure.

---

### Task 1: API calls for scanning

**Files:**
- Modify: `frontend/src/api.js` (the `request()` header logic and the `api` object)

**Interfaces:**
- Produces:
  - `api.readLabel(photo: Blob) → Promise<{name, type, watts}>`
  - `api.startScanSession() → Promise<{code, expiresAt}>`
  - `api.getScanSession(code, options) → Promise<{status: "waiting"|"done"|"expired", result: {name,type,watts}|null}>`
  - `api.sendScanPhoto(code, photo: Blob) → Promise<{status}>`
  - Each thrown `Error` carries `.status` (the HTTP code), so callers can tell 410 and 422 apart.

- [ ] **Step 1: Make `request()` safe for FormData.** Add `Content-Type: application/json` only when `options.body` is not a `FormData`. Set `error.status = response.status` on thrown errors.
- [ ] **Step 2: Add a `photoForm(photo)` helper and the four methods.** The helper builds a `FormData` with the field `photo` and the filename `label.jpg`. Paths are `/scans/read`, `/scan-sessions`, `/scan-sessions/${code}` and `/scan-sessions/${code}/photo`. Add a `fromScanSession` that maps `expires_at` to `expiresAt`. The scan result keys are already camelCase-safe (`name, type, watts`).
- [ ] **Step 3: Verify.** Run `npm run build`. Expected: it builds with no errors.
- [ ] **Step 4: Commit.** Message: `feat(frontend): add scan API calls`.

### Task 2: Upload and Take photo inside the form

**Files:**
- Create: `frontend/src/lib/scan.js`
- Create: `frontend/src/pages/Appliances/ScanControls.jsx`
- Modify: `frontend/src/pages/Appliances/ApplianceForm.jsx` (replace the disabled "Scan appliance (coming soon)" button, lines 59–63)
- Test backend (not committed): add `POST /api/scans/read` to `scratchpad/run_test_backend.py`. It returns `{"name":"Window aircon","type":"aircon","watts":900}`, or a 422 when the uploaded file name contains `blurry`.

**Interfaces:**
- Consumes: `api.readLabel` (Task 1).
- Produces:
  - `shrinkPhoto(file: File) → Promise<Blob>` in `lib/scan.js`. Longest side ≤ 1600 px, JPEG quality 0.85, using `createImageBitmap` and a canvas. It throws `Error("That file isn't a photo we can read.")` on decode failure.
  - `<ScanControls onResult={(result) => void} onPhoneScan={() => void} disabled />`. `onPhoneScan` is wired in Task 3; until then the desktop button is not rendered.
  - In `ApplianceForm`: `applyScan(result)` sets `name`, `type` (falls back to `"other"` if unknown) and `watts` (as a string), clears those fields' errors, then focuses `#hoursPerDay`.

- [ ] **Step 1: Run modern-web-guidance.** Search "loading spinner" and retrieve `spinner`. `forms` and `progress` were already read during design.
- [ ] **Step 2: Write `shrinkPhoto` in `lib/scan.js`.**
- [ ] **Step 3: Write `ScanControls`.**
  - Two hidden file inputs using the visually-hidden recipe (Tailwind `sr-only`), both `accept="image/*"`. The camera input also gets `capture="environment"`.
  - Buttons:
    - Upload photo: lucide `Upload`.
    - Take photo: lucide `Camera`, shown with `md:hidden`.
    - Use my phone: lucide `Smartphone`, shown with `hidden md:inline-flex`. Rendered only when `onPhoneScan` is passed.
  - On `change`: reset `input.value`, then run `shrinkPhoto`, then `api.readLabel`, then `onResult`.
  - One `role="status"` line, always in the DOM, shows "Reading the label…" with the spinner, the success text, or the error text from the spec. Error text uses the `text-danger` token.
- [ ] **Step 4: Wire into `ApplianceForm`.** Render `ScanControls` only when `!editing`. Pass `applyScan` and `disabled={busy}`. Remove the unused `Camera` import.
- [ ] **Step 5: Add the fake `/api/scans/read` to the test backend, then verify.**
  - Run `npm run build`.
  - Run the test backend on 5001 and `API_URL=http://127.0.0.1:5001 npx vite --port 5181`.
  - On the Appliances page:
    - Uploading any image fills Name "Window aircon", Type Aircon, Power 900, and moves focus to Hours per day. Hours typed earlier stay.
    - A file named `blurry.jpg` shows the "Couldn't read the label" message and leaves the form unchanged.
    - At 375 px width, Take photo shows and Use my phone does not.
- [ ] **Step 6: Commit.** Message: `feat(frontend): scan a rating label photo into the appliance form`.

### Task 3: Use my phone (QR dialog)

**Files:**
- Create: `frontend/src/components/ui/dialog.jsx` (via `npx shadcn@latest add dialog`)
- Create: `frontend/src/pages/Appliances/PhoneScanDialog.jsx`
- Modify: `frontend/src/pages/Appliances/ScanControls.jsx` (open the dialog)
- Modify: `frontend/package.json` (`npm install qrcode.react`)
- Test backend (not committed): add `POST /api/scan-sessions`, `GET /api/scan-sessions/<code>` and `POST /api/scan-sessions/<code>/photo`. Keep them in memory, with a 10-minute expiry. The photo endpoint stores the fake aircon result and marks the session `done`.

**Interfaces:**
- Consumes: `api.startScanSession`, `api.getScanSession` (Task 1); `onResult` (Task 2).
- Produces: `<PhoneScanDialog open onOpenChange onResult />`.

- [ ] **Step 1: Run modern-web-guidance.** Search "modal dialog" and retrieve the match. Adapt it to the shadcn Dialog (keep its focus handling).
- [ ] **Step 2: Add the shadcn dialog and `qrcode.react`.**
- [ ] **Step 3: Write `PhoneScanDialog`.**
  - When `open` becomes true: start a session, then render `<QRCodeSVG value={`${window.location.origin}/scan/${code}`} />` with a title and the link text.
  - Poll with `setTimeout` every 2000 ms, passing an `AbortController` signal.
  - On `done`: call `onResult(result)` and close the dialog.
  - On `expired`: stop polling and show a **New code** button that restarts.
  - On close or unmount: abort and clear the timer.
  - "Waiting for photo…" goes in a `role="status"` line.
- [ ] **Step 4: Wire it in.** Use my phone opens the dialog. Results go to the same `onResult` as Upload.
- [ ] **Step 5: Verify.**
  - Run `npm run build`.
  - In the browser at desktop width, Use my phone shows a QR code.
  - Simulate the phone: run `curl -F photo=@<any jpg> http://127.0.0.1:5001/api/scan-sessions/<code>/photo`. Within about 2 s the dialog closes and the form fills.
  - Closing the dialog early stops further `GET` requests (check the network panel).
- [ ] **Step 6: Commit.** Message: `feat(frontend): hand off appliance scans to a phone with a QR code`.

### Task 4: Phone page `/scan/:code`

**Files:**
- Create: `frontend/src/pages/Scan/ScanPhotoPage.jsx`
- Modify: `frontend/src/App.jsx` (add `<Route path="/scan/:code" element={<ScanPhotoPage />} />`)

**Interfaces:**
- Consumes: `api.sendScanPhoto` (Task 1); `shrinkPhoto` (Task 2).

- [ ] **Step 1: Write `ScanPhotoPage`.**
  - Read `code` with `useParams`.
  - Show `PageHeader` with "Scan appliance" and the hint "Take a clear photo of the rating label."
  - One Take photo button using the same hidden-input pattern with `capture="environment"`.
  - Show a preview from `URL.createObjectURL`, revoked on change or unmount.
  - States:
    - sending: spinner
    - sent: "Sent! Check your computer."
    - 410: "This link has expired. Make a new code on your computer."
    - 422: the "couldn't read" text plus a retry
    - other errors: the error message plus a retry
  - All states go in a `role="status"` line.
- [ ] **Step 2: Add the route.**
- [ ] **Step 3: Verify.**
  - Run `npm run build`.
  - With the dialog open in tab 1, open `/scan/<code>` in tab 2 at 375 px and upload a photo. Tab 2 shows "Sent!" and tab 1's form fills.
  - Opening `/scan/badcode` and sending shows the expired message (the fake returns 410 for unknown codes).
- [ ] **Step 4: Commit.** Message: `feat(frontend): add phone scan page`.

### Task 5: Wrap up

- [ ] **Step 1: Full check.** Run `npm run build` and repeat the Task 2–4 browser checks once on the final branch.
- [ ] **Step 2: Hand over.** Push and open a short PR (Summary / Testing / Notes). Notes must say:
  - The backend endpoints from the spec's API contract are still needed.
  - The QR handoff only works on the deployed site.
  - End the PR with the Modern Web Guidance section.
