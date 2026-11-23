import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  Home,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  Share2,
  Sun,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import Logo from "@/components/Logo";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { useTheme } from "@/hooks/useTheme";
import { formatPeso } from "@/lib/energy";
import { cn } from "@/lib/utils";

const NAV_GROUPS = [
  {
    label: "Overview",
    links: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/alerts", label: "Alerts", icon: Bell },
    ],
  },
  {
    label: "Manage",
    links: [
      { to: "/budget", label: "Budget Planner", icon: Wallet },
      { to: "/appliances", label: "Appliances", icon: Plug },
      { to: "/solar", label: "Solar", icon: Sun },
    ],
  },
];

function NavLinks({ onNavigate, collapsed = false }) {
  return NAV_GROUPS.map((group, groupIndex) => (
    <div key={group.label} className={cn("flex flex-col gap-1", groupIndex > 0 && (collapsed ? "mt-2 border-t border-sidebar-border pt-2" : "mt-4"))}>
      {!collapsed && (
        <p className="px-3.5 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
          {group.label}
        </p>
      )}
      {group.links.map(({ to, label, icon: LinkIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          title={collapsed ? label : undefined}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              collapsed ? "justify-center px-0" : "px-3.5",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )
          }
        >
          <LinkIcon className="size-4.5 shrink-0" />
          <span className={collapsed ? "sr-only" : undefined}>{label}</span>
        </NavLink>
      ))}
    </div>
  ));
}

function SidebarHouseholdCard({ collapsed = false }) {
  const { households, householdId, setHouseholdId, openSetup, openShare, openJoin, openDelete } = useHouseholds();
  const active = households.find((item) => String(item.id) === householdId);

  if (!active) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={openSetup}
        title={`${active.name} · Add household`}
        aria-label={`Active household: ${active.name}. Add household`}
        className={ICON_BUTTON}
      >
        <Home className="size-5" />
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-sidebar-border bg-secondary/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          <Home className="size-3.5 text-primary-text" />
          Household
        </span>
        <div className="flex items-center gap-1">
          {openShare && active.is_owner && (
            <button
              type="button"
              onClick={() => openShare(active)}
              title="Share household"
              aria-label="Share household"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              <Share2 className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={openSetup}
            title="Add household"
            aria-label="Add household"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-background hover:text-foreground"
          >
            <Plus className="size-3.5" />
          </button>
          {active.is_owner && (
            <button
              type="button"
              onClick={() => openDelete(active)}
              title="Delete household"
              aria-label="Delete household"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {households.length > 1 ? (
        <Select value={householdId} onValueChange={setHouseholdId}>
          <SelectTrigger size="sm" className="h-8 w-full bg-background text-xs font-medium" aria-label="Switch household">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {households.map((item) => (
              <SelectItem key={item.id} value={String(item.id)}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="truncate text-sm font-semibold">{active.name}</p>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>₱{Number(active.electricity_rate).toFixed(2)}/kWh</span>
        <span className="font-medium text-foreground">{formatPeso(Number(active.monthly_budget))}/mo</span>
      </div>

      {openJoin && (
        <button
          type="button"
          onClick={openJoin}
          className="text-left text-xs font-medium text-primary-text hover:underline"
        >
          Join another with PIN
        </button>
      )}
    </div>
  );
}

function SdgBadge() {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-primary/20 bg-sidebar-accent/50 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-sidebar-accent-foreground">
        <Leaf className="size-3.5 shrink-0" />
        SDG 7 · Clean Energy
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Track usage early, stay on budget, and explore solar savings.
      </p>
    </div>
  );
}

const ICON_BUTTON =
  "flex size-10 items-center justify-center rounded-lg text-muted-foreground transition outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

const AUTH_LINK =
  "flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

// Guests can log in or create an account from here; their data comes with them.
function GuestMenu({ collapsed = false }) {
  const location = useLocation();
  const from = { from: location };

  if (collapsed) {
    return (
      <div className="flex justify-center border-t border-sidebar-border pt-4">
        <Link
          to="/register"
          state={from}
          title="Create account"
          aria-label="Create account"
          className={cn(ICON_BUTTON, "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
        >
          <UserPlus className="size-5" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-sidebar-border pt-4">
      <div>
        <p className="text-sm font-medium">Guest</p>
        <p className="text-xs text-muted-foreground">Create an account to keep your data.</p>
      </div>
      <div className="flex gap-2">
        <Link to="/login" state={from} className={`${AUTH_LINK} border border-border hover:bg-muted`}>
          Log in
        </Link>
        <Link to="/register" state={from} className={`${AUTH_LINK} bg-primary text-primary-foreground hover:bg-primary/90`}>
          Create account
        </Link>
      </div>
    </div>
  );
}

function UserMenu({ collapsed = false }) {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");

  if (user.isGuest) return <GuestMenu collapsed={collapsed} />;

  async function handleLogout() {
    setError("");
    try {
      await logout();
    } catch {
      setError("Couldn't log out. Check your connection and try again.");
    }
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-sidebar-border pt-4">
        <button
          type="button"
          onClick={handleLogout}
          title="Log out"
          aria-label="Log out"
          className={ICON_BUTTON}
        >
          <LogOut className="size-5" />
        </button>
        {error && (
          // The strip is too narrow for the full message: show a short one, keep the rest for hover and screen readers.
          <p role="alert" title={error} className="text-center text-xs text-danger">
            <span aria-hidden="true">Log out failed</span>
            <span className="sr-only">{error}</span>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{user.name}</p>
        <button
          type="button"
          onClick={handleLogout}
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogOut className="size-4" />
          Log out
        </button>
      </div>
    </div>
  );
}

function ThemeToggle({ theme, onToggle, collapsed = false }) {
  const isDark = theme === "dark";
  const action = isDark ? "Switch to light mode" : "Switch to dark mode";
  const Icon = isDark ? Sun : Moon;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={action}
        aria-label={action}
        className={ICON_BUTTON}
      >
        <Icon className="size-5" />
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="Theme"
      className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1"
    >
      <button
        type="button"
        aria-pressed={!isDark}
        onClick={() => isDark && onToggle()}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          !isDark ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Sun className="size-3.5" />
        Light
      </button>
      <button
        type="button"
        aria-pressed={isDark}
        onClick={() => !isDark && onToggle()}
        className={cn(
          "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          isDark ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Moon className="size-3.5" />
        Dark
      </button>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();
  const [theme, toggleTheme] = useTheme();

  return (
    <>
      {/* Mobile: compact top bar with a toggle menu */}
      <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-1">
            <ThemeToggle theme={theme} onToggle={toggleTheme} collapsed />
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
              className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="flex flex-col gap-3 px-4 pb-4">
            <NavLinks onNavigate={() => setOpen(false)} />
            <SidebarHouseholdCard />
            <UserMenu />
          </nav>
        )}
      </header>

      {/* Desktop: full sidebar, or an icons-only strip when collapsed */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-4 overflow-x-hidden overflow-y-auto border-r border-sidebar-border bg-sidebar py-6 transition-[width] duration-200 motion-reduce:transition-none md:flex",
          collapsed ? "w-[72px] px-3" : "w-[240px] px-4",
        )}
      >
        <div className={cn("flex gap-2", collapsed ? "flex-col items-center" : "items-center justify-between px-1")}>
          <Logo compact={collapsed} />
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={ICON_BUTTON}
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-col">
          <NavLinks collapsed={collapsed} />
        </nav>

        <div className={cn(collapsed && "flex justify-center")}>
          <SidebarHouseholdCard collapsed={collapsed} />
        </div>

        <div className={cn("mt-auto flex flex-col gap-3", collapsed && "items-center")}>
          {!collapsed && <SdgBadge />}
          <ThemeToggle theme={theme} onToggle={toggleTheme} collapsed={collapsed} />
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
