# Collapsible Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On desktop, a toggle shrinks the sidebar to a 72px icons-only strip and back. The choice is remembered per browser.

**Architecture:** A `useSidebarCollapsed` hook owns the remembered boolean. `Sidebar.jsx` passes `collapsed` down to its link list, logo and account menu, which each render a compact form. Only the desktop `<aside>` changes; the mobile header is untouched.

**Tech Stack:** React 19 + Vite + Tailwind v4 + lucide-react, plain JavaScript.

**Spec:** `docs/superpowers/specs/2026-11-23-collapsible-sidebar-design.md`

## Global Constraints

- Plain JavaScript only, no tests, no new dependencies (`CLAUDE.md`). Verification is `npm run build` plus a browser check. This frontend has no automated test framework, so the browser check stands in for the TDD red/green cycle.
- Desktop only: every change applies to the `md:` `<aside>`. The mobile `<header>` and its menu stay exactly as on `main`.
- Widths: `w-[260px]` expanded and `w-[72px]` collapsed, with `transition-[width] duration-200 motion-reduce:transition-none`.
- Toggle: lucide `PanelLeftClose` when expanded and `PanelLeftOpen` when collapsed. `aria-label` is `"Collapse sidebar"` / `"Expand sidebar"`, plus `aria-expanded={!collapsed}`.
- Collapsed links: the icon only, with the label kept as `<span className="sr-only">` and `title={label}`. The active highlight is unchanged.
- localStorage key `energywise.sidebarCollapsed`, value `"1"` or `"0"`. Every read and write is inside try/catch; a failure means expanded.
- Use existing theme tokens (`bg-sidebar`, `border-sidebar-border`, `bg-sidebar-accent`, …). Browser checks use a throwaway backend (`API_URL=http://127.0.0.1:5001 npx vite`), **never port 5000**.
- Commits: `feat(frontend): ...`, no AI attribution lines.

## Review Focus

1. **Blocked storage** (private mode, storage disabled): the sidebar must still render expanded and the toggle must still work for the session. Check in the browser by overriding `localStorage.setItem` to throw. (Task 2)
2. **Keyboard users:** Tab reaches the toggle and each icon link, the focus ring is visible on the 72px strip, and Enter or Space toggles. (Task 2)
3. **Long user names or a logout error while collapsed:** nothing overflows the 72px strip; the error text shows without breaking the layout. (Task 2)
4. **Guest vs logged-in while collapsed:** a guest sees a **Create account** icon linking to `/register` with `state.from`; a user sees **Log out**. (Task 2)
5. **Resizing to mobile while collapsed:** the mobile top bar looks normal, and returning to desktop restores the collapsed strip. (Task 2)

---

## File Structure

| File | Responsibility |
| --- | --- |
| `frontend/src/hooks/useSidebarCollapsed.js` (create) | remembered collapsed state |
| `frontend/src/components/Logo.jsx` (modify) | `compact` prop shows only the ⚡ mark |
| `frontend/src/components/Sidebar.jsx` (modify) | toggle, collapsed links, collapsed account menu |

---

### Task 1: Bring `main` into `feat/ui-fix`

**Files:** none edited by hand (merge only).

- [ ] **Step 1: Make sure the working tree is clean.** Run `git status --short`. Expected: no output, apart from the new spec and plan docs; commit those first with `git add docs/superpowers && git commit -m "docs: collapsible sidebar design and plan"`.
- [ ] **Step 2: Merge.** Run `git fetch origin` then `git merge origin/main`. Expected: a clean merge (`feat/ui-fix` has no commits of its own beyond the docs). If anything conflicts, stop and report the files.
- [ ] **Step 3: Install and build.** Run `npm install --prefix frontend` then `npm run build --prefix frontend`. Expected: `✓ built`.

---

### Task 2: Collapsible desktop sidebar

**Files:** Create `frontend/src/hooks/useSidebarCollapsed.js`. Modify `frontend/src/components/Logo.jsx` and `frontend/src/components/Sidebar.jsx`.

**Interfaces:**
- `useSidebarCollapsed() -> [collapsed: boolean, toggle: () => void]` (named export). Its initial value comes from localStorage (`"1"` means true); `toggle` flips the value and saves it.
- `Logo({ compact = false })`: when `compact`, render only the ⚡ square and keep the name as `sr-only`. `AuthCard` and the mobile header keep calling `<Logo />` unchanged.
- In `Sidebar.jsx`:
  - `NavLinks({ onNavigate, collapsed = false })`: when collapsed, `justify-center px-0`, label in `sr-only`, `title={label}`.
  - `UserMenu({ collapsed = false })` and `GuestMenu({ collapsed = false })`. When collapsed:
    - a user gets one icon button (`LogOut`, `title` and `aria-label` "Log out"), and the error `<p role="alert">` still renders below it;
    - a guest gets one icon `Link` to `/register` with `state={from}` (lucide `UserPlus`, `title` and `aria-label` "Create account").
- The desktop `<aside>` uses `const [collapsed, toggle] = useSidebarCollapsed()`. Padding is `px-5` expanded and `px-3` collapsed.
  - **Header row:** expanded, `<Logo />` plus the toggle on the right; collapsed, `<Logo compact />` with the toggle stacked under it, both centred.

- [ ] **Step 1: Implement the hook, `Logo compact`, and the `Sidebar` changes** as described in Interfaces and Global Constraints.
- [ ] **Step 2: Build.** Run `npm run build --prefix frontend`. Expected: `✓ built`, with no new warnings besides the existing chunk-size one.
- [ ] **Step 3: Browser check against a throwaway backend.**
  1. Start the backend on port 5001 against a scratch local Postgres, never port 5000 or Supabase. Then run `API_URL=http://127.0.0.1:5001 npx vite` in `frontend/`.
  2. At desktop width, confirm:
     - the toggle collapses the sidebar to 72px and expands it back, animated;
     - each icon shows its page name on hover;
     - the active page stays highlighted;
     - a reload keeps the choice.
  3. Check Review Focus 1–5:
     - blocked storage still works;
     - Tab and Enter work;
     - a long name or a logout error doesn't overflow;
     - the guest and logged-in icons are right;
     - mobile width is unchanged.
- [ ] **Step 4: Commit.** `git add frontend/src && git commit -m "feat(frontend): collapsible desktop sidebar"`.
