// Energy and cost calculations shared by every page.
//
// An "appliance" here is any object with:
//   watts        – power rating from the label, e.g. 900
//   quantity     – how many of them, e.g. 5 light bulbs
//   hoursPerDay  – how long they run each day, e.g. 4

export const RATE_PER_KWH = 12; // ₱ per kWh (will come from settings later)
export const DAYS_PER_MONTH = 30;

// kWh used in one day: watts × quantity × hours ÷ 1000
export function dailyKwh(appliance) {
  const { watts, quantity, hoursPerDay } = appliance;
  return (watts * quantity * hoursPerDay) / 1000;
}

export function monthlyKwh(appliance) {
  return dailyKwh(appliance) * DAYS_PER_MONTH;
}

export function monthlyCost(appliance, rate = RATE_PER_KWH) {
  return monthlyKwh(appliance) * rate;
}

export function totalDailyKwh(appliances) {
  let total = 0;
  for (const appliance of appliances) {
    total += dailyKwh(appliance);
  }
  return total;
}

// 3.6000000004 → "3.6 kWh", 1234.56 → "1,234.6 kWh"
export function formatKwh(kwh) {
  const text = kwh.toLocaleString("en-US", { maximumFractionDigits: 1 });
  return `${text} kWh`;
}

// 1296.0000001 → "₱1,296"
export function formatPeso(amount) {
  const text = Math.round(amount).toLocaleString("en-US");
  return `₱${text}`;
}
