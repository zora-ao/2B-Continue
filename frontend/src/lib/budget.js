// Budget planning: given a monthly budget, suggest how many hours a day
// each appliance should run so the bill stays within it.
//
// Rules:
//   - Must-have appliances keep their hours.
//   - Flexible ones are trimmed first, starting with the most power-hungry.
//   - Hours are trimmed in half-hour steps.
import { dailyKwh, monthlyCost } from "./energy";

// How much of the budget the plan aims to use.
// Strict leaves the most room for surprises on the bill.
export const PLAN_STYLES = [
  { value: "strict", label: "Strict", share: 0.85 },
  { value: "balanced", label: "Balanced", share: 0.95 },
  { value: "comfort", label: "Comfort", share: 1 },
];

// How much energy the budget buys: ₱2,000 at ₱12/kWh → 166.7 kWh a month.
export function energyAllowance(budget, rate, days) {
  const monthlyKwh = budget / rate;
  return {
    monthlyKwh,
    dailyKwh: monthlyKwh / days,
    dailyCost: budget / days,
  };
}

// Returns a copy of the appliances with suggested hoursPerDay.
// Each item also gets originalHours so the page can show "was 4h".
export function makePlan(appliances, budget, rate, days, style) {
  const share = PLAN_STYLES.find((item) => item.value === style).share;
  const target = budget * share;

  const plan = appliances.map((appliance) => ({
    ...appliance,
    originalHours: appliance.hoursPerDay,
  }));

  // Most power-hungry flexible appliances first.
  const flexible = plan
    .filter((appliance) => !appliance.isMustHave)
    .sort((a, b) => b.watts * b.quantity - a.watts * a.quantity);

  for (const appliance of flexible) {
    const overspend = planCost(plan, rate, days) - target;
    if (overspend <= 0) {
      break;
    }

    // Cost of running this appliance one hour a day for the whole month.
    const costPerHour = monthlyCost({ ...appliance, hoursPerDay: 1 }, rate, days);
    const hoursToCut = roundUpToHalf(overspend / costPerHour);
    appliance.hoursPerDay = Math.max(0, appliance.hoursPerDay - hoursToCut);
  }

  return plan;
}

// Totals for the plan's "Total" row.
export function planTotals(plan, rate, days) {
  let kwhPerDay = 0;
  for (const appliance of plan) {
    kwhPerDay += dailyKwh(appliance);
  }
  return { kwhPerDay, costPerMonth: planCost(plan, rate, days) };
}

function planCost(plan, rate, days) {
  let total = 0;
  for (const appliance of plan) {
    total += monthlyCost(appliance, rate, days);
  }
  return total;
}

// 1.2 → 1.5, 2 → 2
function roundUpToHalf(hours) {
  return Math.ceil(hours * 2) / 2;
}
