# Kuryenta

SDG 7 energy-saving web app. `frontend/` is React + Vite + Tailwind v4 + shadcn/ui. `backend/` is Flask + SQLAlchemy on Supabase Postgres.

## Frontend rules

- Plain JavaScript only. No TypeScript, no tests, no React Query.
- Keep code simple and readable. New pages follow the same layout as `src/pages/Budget/`: a `<Name>Page.jsx` that owns state, small components next to it, and helpers in `src/lib/`.
- `src/api.js` is the only place that converts the API's snake_case to camelCase.
- Use the existing shadcn components in `src/components/ui/` and Tailwind theme tokens from `src/index.css`. Don't replace them with native `<dialog>`, `<select>`, or popover versions.
- Verify with `npm run build` and a check in the browser. For local checks, point Vite at a throwaway backend (`API_URL=http://127.0.0.1:5001 npx vite`). Never test against the real backend on port 5000, which uses live Supabase data.

## Modern Web Guidance

Use the `modern-web-guidance` skill for accessibility, forms, CSS layout, and performance details. Its guides use plain HTML and CSS, so adapt them to React, Tailwind classes, and our shadcn components rather than swapping components out.

**Browser support:** Baseline Widely available features only. Skip polyfills; use a small fallback or leave the feature out.

## Git

- Branch from an up-to-date `main` and open short PRs (Summary / Testing / Notes).
- Don't add AI attribution lines (such as `Co-Authored-By`) to commits or PRs.
