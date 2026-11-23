export const PLAN_STYLES = [
  { value: "strict", label: "Strict", hint: "Aims for 90% of your budget, leaving room for surprises." },
  { value: "balanced", label: "Balanced", hint: "Uses up to your full budget." },
  { value: "comfort", label: "Comfort", hint: "Shares the cuts across all flexible appliances." },
];

// Worked out in the browser (not on the server) so it updates while typing.
export function energyAllowance(budget, rate, days) {
  const monthlyKwh = budget / rate;
  return {
    monthlyKwh,
    dailyKwh: monthlyKwh / days,
    dailyCost: budget / days,
  };
}

export function parseBudget(text) {
  if (text.trim() === "") return null;
  const budget = Number(text);
  if (!(budget >= 0)) return null;
  const hasAtMostTwoDecimals = Math.abs(budget * 100 - Math.round(budget * 100)) < 0.000001;
  return hasAtMostTwoDecimals ? budget : null;
}

export function roundHours(hours) {
  return Math.round(hours * 1000) / 1000;
}
