# Collapsible Sidebar — Design (short)

**Date:** 2026-11-23
**Branch:** `feat/ui-fix`. It is 43 commits behind `main`, so it gets the latest `origin/main` merged in first. The work builds on `main`'s current `Sidebar.jsx` (sticky layout, user/guest menu, `Logo` component).
**Scope:** frontend only, desktop only (`md:` and up). The mobile top bar and its menu are unchanged.

## Why

Users want more room for page content on desktop without losing quick navigation. A toggle shrinks the sidebar to the side, and pressing it again restores it.

## Approaches (user picked A)

- **A. Icons-only strip (chosen).** It collapses to about 72px wide and keeps the icons, so navigation is still one click. Hovering shows the page name. This is the common dashboard pattern.
- B. Hidden completely, with just a button at the edge. It gives the most room, but people must reopen the sidebar to change pages.

## Decided

- **Toggle:** a small button next to the logo. When expanded it shows a collapse icon, and when collapsed an expand icon (lucide `PanelLeftClose` / `PanelLeftOpen`).
  - It has `aria-label` "Collapse sidebar" / "Expand sidebar" and `aria-expanded`.
  - In the collapsed strip, the button sits under the ⚡ mark.
- **Widths:** 260px expanded and 72px collapsed, with a short width transition. Under `prefers-reduced-motion` there is no animation (Tailwind `motion-reduce:transition-none`).
- **Collapsed contents:**
  - **Links:** each nav link shows only its icon, centred. The label stays in the DOM as screen-reader text (`sr-only`), and `title` shows the page name on hover. The active page keeps its highlight.
  - **Logo:** `Logo` gets a compact form that shows only the ⚡ mark.
  - **Account area:** a logged-in user gets a single **Log out** icon button (`title`/`aria-label` "Log out"). A guest gets a single **Create account** icon link to `/register`, keeping the existing `state={{ from: location }}`. If logging out fails, the error message still shows.
- **Remembering:** the collapsed or expanded choice is saved in `localStorage` (key `energywise.sidebarCollapsed`), read and written inside try/catch so blocked storage just falls back to expanded. This is the same approach as `useHouseholds`. The logic lives in a small hook, `src/hooks/useSidebarCollapsed.js`, which returns `[collapsed, toggle]`.
- **Style:** existing Tailwind theme tokens and lucide icons, no new dependencies. There's no shadcn tooltip in `components/ui/`, so the hover hint is the `title` attribute (builder's call).

## Non-goals

- Changing the mobile layout.
- A custom tooltip component, keyboard shortcuts, or a hover-to-peek panel.
- Remembering the choice per account (it's per browser).

## Verify

- `npm run build`.
- A browser check with a throwaway backend (`API_URL=http://127.0.0.1:5001 npx vite`, never port 5000):
  - toggle both ways;
  - a reload keeps the choice;
  - hover names show;
  - the active highlight stays;
  - mobile width is unchanged;
  - keyboard focus works on the toggle and the links.
