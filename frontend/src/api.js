// Talks to the Flask API. In development, Vite forwards /api to Flask
// (see vite.config.js).
//
// The API uses snake_case (hours_per_day); components use camelCase
// (hoursPerDay). toApi / fromApi below convert between them, so only
// this file knows the API's field names.
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (response.status === 204) {
    return null; // e.g. after DELETE: success, nothing to read
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Request failed: ${response.status}`);
  }
  if (!data) {
    throw new Error("The server returned an invalid response.");
  }
  return data;
}

function toApi(appliance) {
  return {
    name: appliance.name,
    appliance_type: appliance.type,
    watts: appliance.watts,
    quantity: appliance.quantity,
    hours_per_day: appliance.hoursPerDay,
    is_must_have: appliance.isMustHave,
  };
}

function fromApi(item) {
  return {
    id: item.id, name: item.name, type: item.appliance_type || "other",
    watts: item.watts, quantity: item.quantity,
    hoursPerDay: item.hours_per_day, isMustHave: item.is_must_have,
    estimatedMonthlyKwh: item.estimated_monthly_kwh,
    estimatedMonthlyCost: item.estimated_monthly_cost,
  };
}

const appliancePath = (householdId) => `/households/${householdId}/appliances`;
const plannerPath = (householdId) => `/households/${householdId}/budget-planner`;

// --- Budget planner -------------------------------------------------

// What the page sends: { month, budget, style, adjustments: [{ id, hours }] }
function toPlanRequest(request) {
  return {
    month: request.month,
    monthly_budget: request.budget,
    style: request.style,
    adjustments: request.adjustments.map((adjustment) => ({
      appliance_id: adjustment.id,
      hours_per_day: adjustment.hours,
    })),
  };
}

// A plan calculated by the server.
function fromPlan(plan) {
  return {
    month: plan.month,
    days: plan.days_in_month,
    style: plan.style,
    budget: plan.monthly_budget,
    rate: plan.electricity_rate,
    fitsBudget: plan.fits_budget,
    items: plan.items.map((item) => ({
      id: item.appliance_id,
      name: item.name,
      type: item.appliance_type || "other",
      watts: item.watts,
      quantity: item.quantity,
      isMustHave: item.is_must_have,
      originalHours: item.original_hours_per_day,
      hoursPerDay: item.hours_per_day,
      isReduced: item.is_reduced,
      dailyKwh: item.estimated_daily_kwh,
      monthlyCost: item.estimated_monthly_cost,
    })),
    totals: {
      dailyKwh: plan.totals.estimated_daily_kwh,
      monthlyCost: plan.totals.estimated_monthly_cost,
      savings: plan.totals.estimated_monthly_savings,
    },
    warnings: plan.warnings,
    tips: plan.tips,
  };
}

function fromSavedPlan(saved) {
  if (!saved) return null;
  return { isStale: saved.is_stale, updatedAt: saved.updated_at, plan: fromPlan(saved.plan) };
}

export const api = {
  health: () => request("/health"),
  listHouseholds: () => request("/households"),
  createHousehold: (data) => request("/households", {
    method: "POST", body: JSON.stringify(data),
  }),
  listAppliances: async (householdId, options) => {
    const data = await request(appliancePath(householdId), options);
    return { ...data, items: data.items.map(fromApi) };
  },
  saveAppliance: async (householdId, appliance, id, month) => {
    const data = await request(`${appliancePath(householdId)}${id ? `/${id}` : ""}${month ? `?month=${encodeURIComponent(month)}` : ""}`, {
      method: id ? "PATCH" : "POST", body: JSON.stringify(toApi(appliance)),
    });
    return fromApi(data.item);
  },
  deleteAppliance: (householdId, id) => request(`${appliancePath(householdId)}/${id}`, {
    method: "DELETE",
  }),

  // Defaults, an unsaved preview, and this month's saved plan (or null).
  getBudgetPlanner: async (householdId, options) => {
    const data = await request(plannerPath(householdId), options);
    return {
      defaults: {
        month: data.defaults.month,
        budget: data.defaults.monthly_budget,
        style: data.defaults.style,
      },
      preview: fromPlan(data.preview),
      savedPlan: fromSavedPlan(data.saved_plan),
    };
  },
  // Calculates a plan without saving it.
  generateBudgetPlan: async (householdId, planRequest) => {
    const data = await request(`${plannerPath(householdId)}/generate`, {
      method: "POST", body: JSON.stringify(toPlanRequest(planRequest)),
    });
    return fromPlan(data.plan);
  },
  // Saves the plan for that month (replaces any earlier one).
  saveBudgetPlan: async (householdId, planRequest) => {
    const data = await request(`${plannerPath(householdId)}/plan`, {
      method: "PUT", body: JSON.stringify(toPlanRequest(planRequest)),
    });
    return fromSavedPlan(data.saved_plan);
  },
};
