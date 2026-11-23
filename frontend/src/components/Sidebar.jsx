import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Bell, LayoutDashboard, LogOut, Menu, Plug, Sun, Wallet, X } from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/budget", label: "Budget Planner", icon: Wallet },
  { to: "/appliances", label: "Appliances", icon: Plug },
  { to: "/solar", label: "Solar", icon: Sun },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

function NavLinks({ onNavigate }) {
  return LINKS.map(({ to, label, icon: LinkIcon }) => (
    <NavLink
      key={to}
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:text-foreground",
        )
      }
    >
      <LinkIcon className="size-5" />
      {label}
    </NavLink>
  ));
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    try {
      await logout();
      navigate("/login", { replace: true });
    } catch {
      setError("Couldn't log out. Check your connection and try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-sidebar-border pt-4">
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium">{user?.name}</p>
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

      {/* Desktop: full sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[260px] shrink-0 flex-col gap-1.5 border-r border-sidebar-border bg-sidebar px-5 py-7 md:flex">
        <div className="mb-6">
          <Logo />
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1.5">
          <NavLinks />
        </nav>
        <div className="mt-auto">
          <UserMenu />
        </div>
      </aside>
    </>
  );
}
