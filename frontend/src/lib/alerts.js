import { CalendarDays, Plug, Sun, TriangleAlert, Wallet, Zap } from "lucide-react";
import { formatKwh, formatPeso } from "@/lib/energy";

export const ALERT_CATEGORIES = [
  { value: "all", label: "All" },
  { value: "budget", label: "Budget", badge: "danger" },
  { value: "usage", label: "Usage", badge: "warning" },
  { value: "appliances", label: "Appliances", badge: "warning" },
  { value: "solar", label: "Solar", badge: "solar" },
];

const RULE_ICONS = {
  bill_over_budget: Wallet,
  daily_limit_exceeded: Zap,
  unusual_spike: TriangleAlert,
  wasteful_appliances: Plug,
  solar_underperforming: Sun,
  weekly_summary: CalendarDays,
};

const SEVERITY_STYLES = {
  danger: { icon: "bg-danger-soft text-danger", border: "border-danger" },
  warning: { icon: "bg-warning-soft text-warning", border: "border-warning" },
  info: { icon: "bg-green-soft text-green", border: "border-green" },
};

export function alertStyle(alert) {
  const severity = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES.info;
  const category = ALERT_CATEGORIES.find((option) => option.value === alert.category);
  return {
    Icon: RULE_ICONS[alert.rule] ?? TriangleAlert,
    iconColor: severity.icon,
    unreadBorder: severity.border,
    badge: category?.badge ?? "secondary",
    categoryLabel: category?.label ?? alert.category,
  };
}

export function alertRules(thresholds) {
  return [
    {
      name: "daily_limit_exceeded",
      label: "Daily limit exceeded",
      hint: `When a day goes over ${formatKwh(thresholds.dailyLimitKwh)}`,
    },
    {
      name: "bill_over_budget",
      label: "Bill over budget",
      hint: `When the projected bill passes ${formatPeso(thresholds.monthlyBudget)}`,
    },
    {
      name: "unusual_spike",
      label: "Unusual spike",
      hint: `When usage is ${thresholds.spikePercent}% above your average`,
    },
    {
      name: "wasteful_appliances",
      label: "Wasteful appliances",
      hint: "Your biggest energy user and standby power",
    },
    {
      name: "solar_underperforming",
      label: "Solar underperforming",
      hint: `When output is under ${thresholds.solarMinPercent}% of expected`,
    },
    { name: "weekly_summary", label: "Weekly summary", hint: "A recap every Sunday" },
  ];
}

const timeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS = [
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

export function timeAgo(isoDateTime) {
  const secondsAgo = (Date.now() - new Date(isoDateTime).getTime()) / 1000;
  const match = UNITS.find(({ seconds }) => secondsAgo >= seconds);
  if (!match) return "Just now";
  return timeFormat.format(-Math.floor(secondsAgo / match.seconds), match.unit);
}
