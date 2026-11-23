// The API uses snake_case; the app uses camelCase. Only this file converts between them.
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
const dashboardPath = (householdId) => `/households/${householdId}/dashboard`;

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

function fromAlert(alert) {
  return {
    id: alert.id,
    type: alert.type,
    title: alert.title,
    date: alert.date,
    kwh: alert.kwh,
    limitKwh: alert.limit_kwh,
    averageKwh: alert.average_kwh,
    percentAboveAverage: alert.percent_above_average,
    projectedBill: alert.projected_bill,
    overBudgetBy: alert.over_budget_by,
    reduceHours: alert.reduce_hours_per_day,
    monthlySavings: alert.estimated_monthly_savings,
  };
}

function fromDashboard(data) {
  const { usage, budget, solar } = data;
  return {
    month: data.month,
    rate: data.electricity_rate,
    budget: data.monthly_budget,
    usage: {
      todayKwh: usage.today_kwh,
      dailyLimitKwh: usage.daily_limit_kwh,
      monthKwh: usage.month_kwh,
      allowanceKwh: usage.monthly_allowance_kwh,
      allowanceUsedPercent: usage.allowance_used_percent,
    },
    status: {
      status: budget.status,
      spent: budget.spent,
      daysLeft: budget.days_left,
      safePerDay: budget.safe_to_spend_per_day,
      projectedBill: budget.projected_bill,
    },
    solar: { todayKwh: solar.today_kwh, savings: solar.estimated_savings },
    chart: {
      period: data.chart.period,
      points: data.chart.points.map((point) => ({
        startDate: point.start_date,
        kwh: point.kwh,
        limitKwh: point.limit_kwh,
        overLimit: point.over_limit,
      })),
    },
    breakdown: data.appliance_breakdown.items.map((item) => ({
      id: item.appliance_id,
      name: item.name,
      type: item.appliance_type || "other",
      watts: item.watts,
      quantity: item.quantity,
      hoursPerDay: item.hours_per_day,
      percent: item.percentage,
    })),
    alerts: data.alerts.map(fromAlert),
    alertCount: data.alert_count,
  };
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
  generateBudgetPlan: async (householdId, planRequest) => {
    const data = await request(`${plannerPath(householdId)}/generate`, {
      method: "POST", body: JSON.stringify(toPlanRequest(planRequest)),
    });
    return fromPlan(data.plan);
  },
  saveBudgetPlan: async (householdId, planRequest) => {
    const data = await request(`${plannerPath(householdId)}/plan`, {
      method: "PUT", body: JSON.stringify(toPlanRequest(planRequest)),
    });
    return fromSavedPlan(data.saved_plan);
  },

  getDashboard: async (householdId, period, options) => {
    const data = await request(`${dashboardPath(householdId)}?period=${period}`, options);
    return fromDashboard(data);
  },
  // reading is { date, kind: "consumption" | "meter", kwh }
  logMeterReading: (householdId, reading) => {
    const field = reading.kind === "meter" ? "meter_reading_kwh" : "consumption_kwh";
    return request(`${dashboardPath(householdId)}/meter-readings`, {
      method: "POST", body: JSON.stringify({ date: reading.date, [field]: reading.kwh }),
    });
  },
};
