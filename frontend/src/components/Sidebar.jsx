import { NavLink } from "react-router-dom";
import Icon from "./Icon.jsx";

const LINKS = [
  { to: "/", label: "Dashboard", icon: "dashboard" },
  { to: "/budget", label: "Budget Planner", icon: "wallet" },
  { to: "/appliances", label: "Appliances", icon: "plug" },
  { to: "/solar", label: "Solar", icon: "sun" },
  { to: "/alerts", label: "Alerts", icon: "bell" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-[260px] shrink-0 flex-col gap-1.5 border-r border-line bg-surface px-5 py-7">
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green text-on-accent">
          <Icon name="zap" size={18} />
        </div>
        <span className="font-display text-xl font-medium">EnergyWise</span>
      </div>

      {/* Navigation */}
      {LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/"}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition ${
              isActive ? "bg-green-soft text-green" : "text-muted hover:text-ink"
            }`
          }
        >
          <Icon name={link.icon} size={20} />
          {link.label}
        </NavLink>
      ))}

      {/* SDG 7 card, pushed to the bottom */}
      <div className="mt-auto rounded-2xl bg-green-soft p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-green">SDG 7</p>
        <p className="mt-1 text-xs text-ink">Affordable and clean energy for every household.</p>
      </div>
    </aside>
  );
}
