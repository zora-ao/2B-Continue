export const RATE_PER_KWH = 12;
export const DAYS_PER_MONTH = 30;

export function dailyKwh(appliance) {
  const { watts, quantity, hoursPerDay } = appliance;
  return (watts * quantity * hoursPerDay) / 1000;
}

export function monthlyKwh(appliance, days = DAYS_PER_MONTH) {
  return dailyKwh(appliance) * days;
}

export function monthlyCost(appliance, rate = RATE_PER_KWH, days = DAYS_PER_MONTH) {
  return monthlyKwh(appliance, days) * rate;
}

export function totalDailyKwh(appliances) {
  let total = 0;
  for (const appliance of appliances) {
    total += dailyKwh(appliance);
  }
  return total;
}

export function formatNumber(value) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

export function formatKwh(kwh) {
  return `${formatNumber(kwh)} kWh`;
}

export function formatPeso(amount) {
  const text = Math.round(amount).toLocaleString("en-US");
  return `₱${text}`;
}
