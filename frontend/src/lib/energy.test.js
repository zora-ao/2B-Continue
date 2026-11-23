import { describe, expect, test } from "vitest";
import {
  dailyKwh,
  formatKwh,
  formatPeso,
  monthlyCost,
  monthlyKwh,
  totalDailyKwh,
} from "./energy.js";

// A 900 W aircon used 4 hours a day.
const aircon = { watts: 900, quantity: 1, hoursPerDay: 4 };
const fridge = { watts: 150, quantity: 1, hoursPerDay: 24 };

describe("energy math", () => {
  test("daily kWh = watts × quantity × hours ÷ 1000", () => {
    expect(dailyKwh(aircon)).toBe(3.6);
  });

  test("quantity multiplies the usage", () => {
    const fiveBulbs = { watts: 9, quantity: 5, hoursPerDay: 5 };
    expect(dailyKwh(fiveBulbs)).toBeCloseTo(0.225);
  });

  test("monthly kWh uses a 30-day month", () => {
    expect(monthlyKwh(aircon)).toBeCloseTo(108);
  });

  test("monthly cost uses ₱12 per kWh by default", () => {
    expect(monthlyCost(aircon)).toBeCloseTo(1296);
  });

  test("monthly cost can use a different rate", () => {
    expect(monthlyCost(aircon, 10)).toBeCloseTo(1080);
  });

  test("total daily kWh adds up every appliance", () => {
    expect(totalDailyKwh([aircon, fridge])).toBeCloseTo(7.2);
  });

  test("total daily kWh of no appliances is 0", () => {
    expect(totalDailyKwh([])).toBe(0);
  });
});

describe("formatting", () => {
  test("formatKwh drops '.0' and floating-point noise", () => {
    expect(formatKwh(108)).toBe("108 kWh");
    expect(formatKwh(3.6000000004)).toBe("3.6 kWh");
  });

  test("formatKwh adds thousands separators", () => {
    expect(formatKwh(1234.56)).toBe("1,234.6 kWh");
  });

  test("formatPeso rounds to whole pesos with separators", () => {
    expect(formatPeso(1296.0000001)).toBe("₱1,296");
    expect(formatPeso(80.6)).toBe("₱81");
    expect(formatPeso(0)).toBe("₱0");
  });
});
