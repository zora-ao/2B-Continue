import { describe, expect, test } from "vitest";
import { applianceToForm, parseApplianceForm } from "./applianceForm.js";

// What the form state looks like: every input value is a string.
const validForm = {
  name: "  Aircon ",
  type: "aircon",
  watts: "900",
  hoursPerDay: "2.5",
  quantity: "1",
  isMustHave: false,
};

describe("parseApplianceForm — valid input", () => {
  test("turns text into numbers and trims the name", () => {
    const { appliance, errors } = parseApplianceForm(validForm);

    expect(errors).toEqual({});
    expect(appliance).toEqual({
      name: "Aircon",
      type: "aircon",
      watts: 900,
      hoursPerDay: 2.5,
      quantity: 1,
      isMustHave: false,
    });
  });

  test("accepts 0 and 24 hours", () => {
    expect(parseApplianceForm({ ...validForm, hoursPerDay: "0" }).errors).toEqual({});
    expect(parseApplianceForm({ ...validForm, hoursPerDay: "24" }).errors).toEqual({});
  });
});

describe("parseApplianceForm — invalid input", () => {
  test("a blank name is rejected", () => {
    const { errors } = parseApplianceForm({ ...validForm, name: "   " });
    expect(errors.name).toBe("Name is required");
  });

  test.each(["0", "-5", "", "abc"])("watts %j is rejected", (watts) => {
    const { errors } = parseApplianceForm({ ...validForm, watts });
    expect(errors.watts).toBe("Watts must be more than 0");
  });

  test.each(["24.5", "-1", ""])("hours %j is rejected", (hoursPerDay) => {
    const { errors } = parseApplianceForm({ ...validForm, hoursPerDay });
    expect(errors.hoursPerDay).toBe("Hours must be between 0 and 24");
  });

  test.each(["0", "1.5", ""])("quantity %j is rejected", (quantity) => {
    const { errors } = parseApplianceForm({ ...validForm, quantity });
    expect(errors.quantity).toBe("Quantity must be a whole number, 1 or more");
  });

  test("no appliance is returned when there are errors", () => {
    const { appliance } = parseApplianceForm({ ...validForm, name: "" });
    expect(appliance).toBeNull();
  });
});

describe("applianceToForm", () => {
  test("a saved appliance can be loaded back into the form unchanged", () => {
    const { appliance } = parseApplianceForm(validForm);
    const savedAppliance = { id: "abc", ...appliance };

    const form = applianceToForm(savedAppliance);

    expect(parseApplianceForm(form).appliance).toEqual(appliance);
  });
});
