export const CHART_PERIODS = [
  { value: "day", label: "Day", range: "Last 14 days", limit: "daily limit" },
  { value: "week", label: "Week", range: "Last 8 weeks", limit: "weekly limit" },
  { value: "month", label: "Month", range: "Last 12 months", limit: "monthly allowance" },
];

export const BUDGET_STATUS = {
  on_track: { label: "On track", badge: "success" },
  projected_over_budget: { label: "Heading over", badge: "warning" },
  over_budget: { label: "Over budget", badge: "danger" },
  no_data: { label: "No readings", badge: "secondary" },
};

export function monthLabel(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

// Dates are "YYYY-MM-DD"; read them as local dates so the day doesn't shift.
function toDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function chartLabel(startDate, period) {
  const date = toDate(startDate);
  if (period === "day") return String(date.getDate());
  if (period === "week") return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function todayIso() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function parseKwh(text) {
  if (text.trim() === "") return null;
  const kwh = Number(text);
  if (!(kwh >= 0)) return null;
  const hasAtMostThreeDecimals = Math.abs(kwh * 1000 - Math.round(kwh * 1000)) < 0.000001;
  return hasAtMostThreeDecimals ? kwh : null;
}
