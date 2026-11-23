// Budget planner helpers for the page. The plan itself (which hours to
// trim) is calculated by the server: see api.generateBudgetPlan.

// Labels for the server's plan styles.
export const PLAN_STYLES = [
  { value: "strict", label: "Strict", hint: "Aims for 90% of your budget, leaving room for surprises." },
  { value: "balanced", label: "Balanced", hint: "Uses up to your full budget." },
  { value: "comfort", label: "Comfort", hint: "Shares the cuts across all flexible appliances." },
];

// How much energy the budget buys: ₱2,000 at ₱12/kWh → 166.7 kWh a month.
// Worked out here (not on the server) so it updates while typing.
export function energyAllowance(budget, rate, days) {
  const monthlyKwh = budget / rate;
  return {
    monthlyKwh,
    dailyKwh: monthlyKwh / days,
    dailyCost: budget / days,
  };
}

// Turns a typed budget into a number, or null when it isn't valid.
// The server accepts 0 or more, with up to 2 decimal places.
export function parseBudget(text) {
  if (text.trim() === "") return null;
  const budget = Number(text);
  if (!(budget >= 0)) return null;
  const hasAtMostTwoDecimals = Math.abs(budget * 100 - Math.round(budget * 100)) < 0.000001;
  return hasAtMostTwoDecimals ? budget : null;
}

// Rounds hours to the server's 3 decimal places: 0.8330000001 → 0.833
export function roundHours(hours) {
  return Math.round(hours * 1000) / 1000;
}
