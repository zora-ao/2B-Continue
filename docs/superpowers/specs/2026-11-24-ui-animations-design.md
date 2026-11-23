# UI animations — design

**Branch:** `feat/ui-animations` · **Size:** small change · **Status:** approved 2026-11-24

## Intent

Make Kuryenta feel smooth and polished when switching pages and when cards and inputs appear or react. The motion should be very simple and quiet: it should be felt, not noticed.

## Goals

- When the page changes, the new page eases in.
- Cards appear with a gentle cascade.
- Inputs, selects and textareas soften their focus state instead of snapping.

## Non-goals and anti-goals

- No exit animations. Navigation must never feel slower.
- No new dependencies (no motion or framer-motion libraries).
- No bouncy, long or attention-grabbing motion.
- Shadcn components are not replaced, as CLAUDE.md requires.

## Constraints

- Plain JS, Tailwind v4 and shadcn, following CLAUDE.md.
- Baseline Widely available features only.
- Respect `prefers-reduced-motion`: no movement at all for those users.

## Approaches

1. **CSS only, using the existing `tw-animate-css` (chosen).** It is already installed and already drives the fade and zoom on dialogs, popovers and selects, so the feel stays consistent and no dependency is added. Pages remount on navigation inside `AppShell`'s `<main>`, so an enter animation runs naturally on every page change.
2. **View Transitions API** (React Router `viewTransition`). It gives true cross-fades between pages, but same-document view transitions are only newly available in Firefox, not Baseline Widely available, so CLAUDE.md rules it out.
3. **The `motion` library.** It adds exit animations and spring physics, but it means a new dependency and per-component wiring. That is more than "very simple" needs.

## Design

- **Page change:** the page content fades from opacity 0 and rises about 8px over ~250ms, ease-out. This applies to the app pages inside `AppShell` and to the Login and Register pages.
- **Cards:** the same fade and rise, with a ~50ms delay for each card, capped at about 5 cards (later cards share the last delay). Hovering a card brightens its ring slightly using a colour transition.
- **Inputs, selects and textareas:** the border and focus ring transition over ~150ms.
- **Buttons:** keep the existing press nudge and smooth the hover colours.
- **Reduced motion:** all of the above is disabled under `motion-reduce` / `prefers-reduced-motion: reduce`.

## Left to the builder

- Where the page wrapper and its animation class live (for example, a wrapper keyed by `location.pathname` in `AppShell`, or a class on each page's root).
- How the card stagger is applied (for example, a CSS `:nth-child` delay on a utility class, or a `style` delay passed from lists).
- Exact easing values, within the numbers above.
- Verify with `npm run build` and a browser check against a throwaway backend (`API_URL=http://127.0.0.1:5001 npx vite`), never against port 5000.
