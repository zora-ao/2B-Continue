import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Sun,
  UserPlus,
  Wallet,
  X,
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/budget", label: "Budget Planner", icon: Wallet },
  { to: "/appliances", label: "Appliances", icon: Plug },
  { to: "/solar", label: "Solar", icon: Sun },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

function NavLinks({ onNavigate, collapsed = false }) {
  return LINKS.map(({ to, label, icon: LinkIcon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          collapsed ? "justify-center px-0" : "px-3.5",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      <LinkIcon className="size-5 shrink-0" />
      <span className={collapsed ? "sr-only" : undefined}>{label}</span>
    </NavLink>
  ));
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
          <p role="alert" className="text-center text-xs break-words text-danger">
            {error}
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

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const [collapsed, toggleCollapsed] = useSidebarCollapsed();

  return (
    <>
      {/* Mobile: compact top bar with a toggle menu */}
      <header className="sticky top-0 z-20 border-b border-sidebar-border bg-sidebar md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo />
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
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="flex flex-col gap-1.5 px-4 pb-4">
            <NavLinks onNavigate={() => setOpen(false)} />
            <UserMenu />
          </nav>
        )}
      </header>

      {/* Desktop: full sidebar, or an icons-only strip when collapsed */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col gap-1.5 overflow-hidden border-r border-sidebar-border bg-sidebar py-7 transition-[width] duration-200 motion-reduce:transition-none md:flex",
          collapsed ? "w-[72px] px-3" : "w-[260px] px-5",
        )}
      >
        <div className={cn("mb-6 flex gap-2", collapsed ? "flex-col items-center" : "items-center justify-between")}>
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
        <nav aria-label="Main" className="flex flex-col gap-1.5">
          <NavLinks collapsed={collapsed} />
        </nav>
        <div className="mt-auto">
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
}
