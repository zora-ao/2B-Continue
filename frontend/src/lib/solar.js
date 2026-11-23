import { formatNumber } from "@/lib/energy";

export const USAGE_SOURCE_LABELS = {
  meter_readings: "your logged usage",
  appliance_estimates: "your appliance estimates",
  unavailable: null,
};

export function coversText(system) {
  if (system.coversPercent === null) return "—";
  return `~${Math.round(system.coversPercent)}% of bill`;
}

export function paybackText(years) {
  return years === null ? "—" : `${formatNumber(years)} years`;
}

// Budget input: digits with optional commas. Empty means "no limit".
export function parseBudget(text) {
  const cleaned = text.replace(/[,\s₱]/g, "");
  if (cleaned === "") return { valid: true, value: null };
  const value = Number(cleaned);
  const valid = /^\d+(\.\d{1,2})?$/.test(cleaned) && value >= 0;
  return { valid, value: valid ? value : null };
}

export function formatBudgetInput(value) {
  return value === null ? "" : value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

// Shift a "YYYY-MM-DD" date by whole days, staying in local time.
export function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function weekRangeLabel(startDate, endDate) {
  const format = (iso) => {
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return `${format(startDate)} – ${format(endDate)}`;
}
