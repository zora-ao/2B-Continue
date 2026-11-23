# UI Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add simple, quiet enter animations for pages and cards, plus softer focus transitions on inputs.

**Architecture:** CSS only. The existing `tw-animate-css` utilities (`animate-in fade-in slide-in-from-bottom-2 …`) go on a pathname-keyed page wrapper in `AppShell` and on the shadcn `Card`. A small `:nth-child` rule in `index.css` staggers sibling cards. Form controls get an explicit transition list that includes `box-shadow`, so the focus ring fades in.

**Tech Stack:** React 19, React Router 7, Tailwind v4, tw-animate-css (already installed), shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-11-24-ui-animations-design.md`

## Global Constraints

- No new dependencies. Plain JS only. No tests (per CLAUDE.md); verify with `npm run build` plus a browser check.
- Baseline Widely available CSS only. No View Transitions API.
- No exit animations.
- Page: fade plus 8px rise (`slide-in-from-bottom-2`), ~250ms, ease-out.
- Cards: same fade and rise, 50ms stagger per sibling, capped at the 5th card (200ms).
- Form controls: border and ring transition over 150ms.
- Every enter animation also carries `motion-reduce:animate-none`.
- Commits have no `Co-Authored-By` or other AI attribution lines (CLAUDE.md).
- Browser checks run against a throwaway backend only: `API_URL=http://127.0.0.1:5001 npx vite`. Never use port 5000.

## Review Focus

1. **Switching household** (`HouseholdOutlet` is keyed by `householdId`): the page should animate in again once, not flicker twice. Check this in Task 1, step 3.
2. **Staggered cards before their delay starts:** they must stay invisible (`fill-mode-backwards`), not flash fully visible and then fade. Check this in Task 2, step 3.
3. **Fixed or sticky elements inside a page while it animates:** the `transform` only exists during the animation, so nothing should jump after it ends. Check the Appliances page scan controls in Task 1, step 3.
4. **Adding an appliance:** the new `ApplianceCard` should fade in on its own, without re-animating the existing cards. Check this in Task 2, step 3.
5. **Reduced motion:** with the system setting on (DevTools → Rendering → `prefers-reduced-motion: reduce`), nothing moves and everything is visible immediately. Check this in Task 3, step 3.

---

### Task 1: Page enter animation

**Files:**
- Modify: `frontend/src/components/AppShell.jsx` (`HouseholdOutlet`)

**Interfaces:**
- Produces: nothing other tasks use.

- [ ] **Step 1: Wrap the outlet in a keyed, animated div**

  In `HouseholdOutlet`, read `pathname` from `useLocation()`. Return `<div key={pathname} className="animate-in fade-in slide-in-from-bottom-2 duration-250 ease-out motion-reduce:animate-none"><Outlet key={householdId} /></div>`.

- [ ] **Step 2: Build**

  Run: `cd frontend && npm run build`
  Expected: build succeeds with no errors.

- [ ] **Step 3: Browser check**

  Start the throwaway backend and `API_URL=http://127.0.0.1:5001 npx vite`. Click through Dashboard → Budget → Appliances → Solar → Alerts. Expected: each page fades and rises once, with no exit delay. Then check Review Focus items 1 and 3.

- [ ] **Step 4: Commit**

  `git commit -am "feat(frontend): fade pages in on navigation"`

### Task 2: Card enter, stagger and hover

**Files:**
- Modify: `frontend/src/components/ui/card.jsx` (the `Card` className)
- Modify: `frontend/src/index.css` (append a stagger rule)

**Interfaces:**
- Consumes: none.
- Produces: none. Every `Card` animates automatically.

- [ ] **Step 1: Add the animation and hover classes to `Card`**

  Append to the `Card` base className: `animate-in fade-in slide-in-from-bottom-2 duration-300 ease-out fill-mode-backwards motion-reduce:animate-none transition-shadow hover:ring-foreground/15`.

- [ ] **Step 2: Add the stagger rule to `index.css`**

  `[data-slot="card"]:nth-child(2)` gets `animation-delay: 50ms`, `:nth-child(3)` gets 100ms, `:nth-child(4)` gets 150ms, and `:nth-child(n + 5)` gets 200ms.

- [ ] **Step 3: Build and check in the browser**

  Run `npm run build` (expect success). In the browser, check that the Dashboard stat cards and the Solar recommended systems cascade in, and that the Login and Register cards fade in. Check Review Focus items 2 and 4.

- [ ] **Step 4: Commit**

  `git commit -am "feat(frontend): stagger card enter animation"`

### Task 3: Softer focus on form controls

**Files:**
- Modify: `frontend/src/components/ui/input.jsx`, `textarea.jsx`, `select.jsx` (the `SelectTrigger` className), `input-group.jsx` (the `InputGroup` className)

- [ ] **Step 1: Replace `transition-colors` with an explicit transition**

  In each of those classNames, change `transition-colors` to `transition-[color,background-color,border-color,box-shadow] duration-150 ease-out`. Buttons already use `transition-all`, so leave them unchanged.

- [ ] **Step 2: Build**

  Run `npm run build` and expect success.

- [ ] **Step 3: Browser check**

  Tab through the Budget form and the Login form. Expected: the green focus ring fades in over about 150ms instead of snapping. Then check Review Focus item 5 across all three tasks.

- [ ] **Step 4: Commit**

  `git commit -am "feat(frontend): ease focus ring on inputs"`
