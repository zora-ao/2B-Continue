// Everything about an appliance that isn't UI:
// the list of types, and turning form text into a saved appliance.
import { AirVent, Fan, Lightbulb, Plug, Refrigerator, Tv } from "lucide-react";

// To add a new type, add one line here.
export const APPLIANCE_TYPES = [
  { value: "aircon", label: "Aircon", icon: AirVent },
  { value: "refrigerator", label: "Refrigerator", icon: Refrigerator },
  { value: "tv", label: "Television", icon: Tv },
  { value: "fan", label: "Electric fan", icon: Fan },
  { value: "lights", label: "Lights", icon: Lightbulb },
  { value: "other", label: "Other", icon: Plug },
];

export function getTypeIcon(type) {
  const found = APPLIANCE_TYPES.find((item) => item.value === type);
  return found ? found.icon : Plug;
}

// What the form shows when it's empty. Inputs always hold text.
export const EMPTY_FORM = {
  name: "",
  type: "other",
  watts: "",
  hoursPerDay: "",
  quantity: "1",
  isMustHave: false,
};

// Checks the form and returns { appliance, errors }.
//   valid:   appliance is ready to save, errors is {}
//   invalid: appliance is null, errors has a message per field
export function parseApplianceForm(form) {
  const name = form.name.trim();
  const watts = toNumber(form.watts);
  const hoursPerDay = toNumber(form.hoursPerDay);
  const quantity = toNumber(form.quantity);

  const errors = {};
  if (name === "") {
    errors.name = "Name is required";
  }
  if (!(watts > 0)) {
    errors.watts = "Watts must be more than 0";
  }
  if (!(hoursPerDay >= 0 && hoursPerDay <= 24)) {
    errors.hoursPerDay = "Hours must be between 0 and 24";
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
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
  if (text.trim() === "") {
    return NaN;
  }
  return Number(text);
}
