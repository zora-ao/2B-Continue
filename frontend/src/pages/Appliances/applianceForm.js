// Helpers for the "Add appliance" form.
//
// Form inputs always give us text ("900", "2.5"), so before saving we
// check the values and turn them into real numbers.

export const APPLIANCE_TYPES = [
  { value: "aircon", label: "Aircon" },
  { value: "refrigerator", label: "Refrigerator" },
  { value: "tv", label: "Television" },
  { value: "fan", label: "Electric fan" },
  { value: "lights", label: "Lights" },
  { value: "other", label: "Other" },
];

// What the form shows when it's empty.
export const EMPTY_FORM = {
  name: "",
  type: "other",
  watts: "",
  hoursPerDay: "",
  quantity: "1",
  isMustHave: false,
};

// Checks the form and returns { appliance, errors }.
//   - Valid:   appliance is ready to save, errors is {}
//   - Invalid: appliance is null, errors says what's wrong per field
export function parseApplianceForm(form) {
  const name = form.name.trim();
  const watts = toNumber(form.watts);
  const hoursPerDay = toNumber(form.hoursPerDay);
  const quantity = toNumber(form.quantity);

  const errors = {};

  if (name === "" || name.length > 120) {
    errors.name = "Name is required and must be at most 120 characters";
  }
  if (!Number.isFinite(watts) || !(watts > 0 && watts <= 999999999.999) || !hasValidPrecision(watts)) {
    errors.watts = "Enter positive watts with up to 3 decimal places";
  }
  if (!(hoursPerDay >= 0 && hoursPerDay <= 24) || !hasValidPrecision(hoursPerDay)) {
    errors.hoursPerDay = "Hours must be between 0 and 24 with up to 3 decimal places";
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 2147483647) {
    errors.quantity = "Quantity must be a whole number, 1 or more";
  }

  if (Object.keys(errors).length > 0) {
    return { appliance: null, errors };
  }

  const appliance = {
    name,
    type: form.type,
    watts,
    hoursPerDay,
    quantity,
    isMustHave: form.isMustHave,
  };
  return { appliance, errors };
}

// Turns a saved appliance back into form text, for editing.
export function applianceToForm(appliance) {
  return {
    name: appliance.name,
    type: appliance.type,
    watts: String(appliance.watts),
    hoursPerDay: String(appliance.hoursPerDay),
    quantity: String(appliance.quantity),
    isMustHave: appliance.isMustHave,
  };
}

// "900" → 900, "abc" → NaN, "" → NaN (a blank box is not 0).
function toNumber(text) {
  if (String(text).trim() === "") {
    return NaN;
  }
  return Number(text);
}

function hasValidPrecision(value) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
}
