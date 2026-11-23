import { NavLink } from "react-router-dom";
import { Bell, LayoutDashboard, Plug, Sun, Wallet, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/budget", label: "Budget Planner", icon: Wallet },
  { to: "/appliances", label: "Appliances", icon: Plug },
  { to: "/solar", label: "Solar", icon: Sun },
  { to: "/alerts", label: "Alerts", icon: Bell },
];

export default function Sidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-1.5 border-r border-sidebar-border bg-sidebar px-5 py-7">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="size-[18px]" />
        </div>
        <span className="font-heading text-xl font-medium">EnergyWise</span>
      </div>

      {/* Navigation */}
      {LINKS.map(({ to, label, icon: LinkIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
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
      ))}
    </aside>
  );
}
