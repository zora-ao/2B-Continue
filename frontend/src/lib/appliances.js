import { AirVent, Fan, Lightbulb, Plug, Refrigerator, Tv } from "lucide-react";

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

export const EMPTY_FORM = {
  name: "",
  type: "other",
  watts: "",
  hoursPerDay: "",
  quantity: "1",
  isMustHave: false,
};

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
  } else if (form.isMustHave && hoursPerDay === 0) {
    errors.hoursPerDay = "Must-have appliances need more than 0 hours per day";
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

// A blank box is NaN, not 0.
function toNumber(text) {
  if (text.trim() === "") {
    return NaN;
  }
  return Number(text);
}

function hasValidPrecision(value) {
  return Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001;
}
