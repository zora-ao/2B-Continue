# Appliance Scan (camera) — UI Design

**Date:** 2026-11-23
**Scope:** Frontend only. The backend endpoints are specified below so the backend owner can build them; until then the UI is checked against fake endpoints in the throwaway test backend.
**Builds on:** `2026-11-23-appliances-page-design.md` (the form this fills).

## Why

Typing an appliance's watts is the slowest, most error-prone part of setup. Most people don't know the number, but it's printed on the rating label. A photo of the label, read by a vision AI model, fills the Add appliance form so the user only checks it and adds hours per day.

## Goals

- Three ways to get a label photo into the Add appliance form:
  1. **Upload photo** — pick an image file (desktop or phone).
  2. **Take photo** — on a phone, opens the phone's camera app.
  3. **Use my phone** — on desktop, show a QR code; the phone takes the photo; the desktop form fills itself.
- The scan only **pre-fills** name, type, and watts. The user reviews, enters hours/day, and presses the existing Add button. Nothing is saved without that.
- Clear states: reading, filled, couldn't read, link expired.

## Non-goals

- A separate Scan page or the Figma `Mobile / Scan Appliance` result card (user chose "inside the Appliances form").
- A live video viewfinder. The phone's own camera app is more reliable and less code.
- The backend itself (vision model call, storage of scan sessions).
- Auto-saving the appliance, or the "Inefficient" badge.

## Anti-goals

- A scan that silently overwrites what the user already typed without saying so.
- Any fake/mock code shipped in the app. Fakes live only in the uncommitted test backend.

## Approaches considered

- **A. Own Scan page at `/scan`** — matches Figma, more new UI. Not chosen.
- **B. Inside the Add appliance form (chosen)** — the disabled "Scan appliance (coming soon)" button becomes the scan controls; results fill the existing form. Least new UI, one place to review and save.

Capture method (my call): `<input type="file" accept="image/*">`, with `capture="environment"` on the Take photo button. A `getUserMedia` viewfinder was dropped: more code, permission prompts, and flaky on phones.

## How it works

### In the Add appliance form (`ApplianceForm.jsx`)

The "coming soon" button is replaced by a small `ScanControls` row:

```
[ Upload photo ]  [ Take photo ]      ← phone widths (below md)
[ Upload photo ]  [ Use my phone ]    ← md and up
```

- Both photo buttons are `type="button"` and trigger hidden file inputs (visually-hidden, not `display:none`).
- After a photo is picked: the image is shrunk in the browser (longest side 1600 px, JPEG ~0.85) with `createImageBitmap` + canvas, then sent to `api.readLabel(photo)`.
- While reading: buttons disabled, a spinner plus "Reading the label…" in a `role="status"` line.
- On success: name, type, watts are set in the form; hours/day and quantity are kept. The status line says "Filled from the rating label. Check the values, then add hours per day." Focus moves to the Hours/day field.
- On failure (`422`): "Couldn't read the label. Try a clearer photo, or type the details." Form untouched.
- Hidden while editing an existing appliance (scan is for adding).

### Use my phone (desktop)

- Opens a shadcn `Dialog` (added with `npx shadcn@latest add dialog`) titled "Scan with your phone".
- Calls `api.startScanSession()` → `{code, expiresAt}`; shows a QR code (`qrcode.react`) for `${window.location.origin}/scan/${code}`, plus the link as text for copying.
- Polls `api.getScanSession(code)` every 2 s with an `AbortController`; stops when the dialog closes, on `done`, or on `expired`.
- `done` → closes the dialog and fills the form exactly as Upload does.
- `expired` → "This code expired." with a **New code** button.

### Phone page (`/scan/:code`)

- New route, minimal page `pages/Scan/ScanPhotoPage.jsx` (no household picker).
- Heading "Scan appliance", hint "Take a clear photo of the rating label."
- One **Take photo** button (same hidden input + capture). Shows the photo preview, then sends it with `api.sendScanPhoto(code, photo)`.
- States: sending (spinner), sent ("Sent! Check your computer."), expired/used ("This link has expired. Make a new code on your computer."), failed (retry).
- Deep links already work on Vercel via the `/(.*) → /index.html` rewrite.

## API contract (for the backend owner)

All under `/api`. Photos are `multipart/form-data`, field `photo`, JPEG/PNG, ≤ 5 MB. `type` is one of `aircon, refrigerator, tv, fan, lights, other`.

| Method & path | Request | Response |
|---|---|---|
| `POST /scans/read` | `photo` | `200 {name, type, watts}` · `422 {error}` unreadable |
| `POST /scan-sessions` | — | `201 {code, expires_at}` (random, ~10 min) |
| `GET /scan-sessions/<code>` | — | `200 {status: "waiting"\|"done"\|"expired", result: {name,type,watts}\|null}` |
| `POST /scan-sessions/<code>/photo` | `photo` | `200 {status: "done"}` · `410` expired/used · `422` unreadable |

`src/api.js` converts these to camelCase (`expiresAt`) like every other call. Its `request()` must skip the JSON `Content-Type` header when the body is `FormData`.

## Files

- `src/api.js` — `readLabel`, `startScanSession`, `getScanSession`, `sendScanPhoto`; FormData-safe `request()`.
- `src/lib/scan.js` — `shrinkPhoto(file) → Blob`, scan status messages.
- `src/pages/Appliances/ScanControls.jsx` — buttons, hidden inputs, reading/result status.
- `src/pages/Appliances/PhoneScanDialog.jsx` — QR dialog + polling.
- `src/pages/Scan/ScanPhotoPage.jsx` — phone page.
- `src/pages/Appliances/ApplianceForm.jsx` — swap the disabled button for `ScanControls`; accept scan results.
- `src/App.jsx` — `/scan/:code` route.
- New deps: `qrcode.react`; shadcn `dialog`.

## Verification

`npm run build`, then the browser against the throwaway backend on port 5001 with fake scan endpoints (uncommitted): upload fills the form; failure message shows; QR dialog fills the form after the phone page "sends" (simulated by opening `/scan/<code>` in a second tab). Real phone testing needs the deployed site once the backend exists.

## Left to the builder

Exact copy wording, spinner styling (follow modern-web-guidance `spinner`), and dialog layout details within the existing shadcn look.
