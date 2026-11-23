// The API uses snake_case; the app uses camelCase. Only this file converts between them.
const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// These answer 401 for a wrong password or a dead login; refreshing would not help.
const NO_REFRESH_PATHS = new Set(["/auth/login", "/auth/register", "/auth/refresh", "/auth/logout", "/auth/guest"]);

// The login tokens live in HttpOnly cookies. Only the CSRF cookies are readable, by design.
function readCookie(name) {
  const row = document.cookie.split("; ").find((item) => item.startsWith(`${name}=`));
  return row ? decodeURIComponent(row.slice(name.length + 1)) : "";
}

function send(path, options) {
  // FormData (photo uploads) must let the browser set its own multipart header.
  const jsonHeader = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const method = (options.method || "GET").toUpperCase();
  const csrfHeader = WRITE_METHODS.has(method) ? { "X-CSRF-TOKEN": readCookie("csrf_access_token") } : {};
  return fetch(`/api${path}`, {
    ...options,
    headers: { ...jsonHeader, ...csrfHeader, ...options.headers },
  });
}

// The access login lasts 15 minutes. Parallel 401s share one refresh.
// Resolves "ok", "conflict" (another tab refreshed a moment ago), false (the login is over),
// or "error" (server or network trouble: the login may still be fine, so keep it).
let refreshing = null;
function refreshLogin() {
  refreshing ??= fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "X-CSRF-TOKEN": readCookie("csrf_refresh_token") },
  })
    .then((response) => {
      if (response.ok) return "ok";
      if (response.status === 409) return "conflict";
      return response.status === 401 ? false : "error";
    })
    .catch(() => "error")
    .then((result) => {
      // Fired once per ended login, not once per waiting request.
      if (result === false) window.dispatchEvent(new Event("auth:expired"));
      return result;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function request(path, options = {}) {
  let response = await send(path, options);
  // After a "conflict" the other tab's new cookies may land a moment later, so allow one more try.
  for (let attempt = 0; attempt < 2 && response.status === 401 && !NO_REFRESH_PATHS.has(path); attempt++) {
    const result = await refreshLogin();
    if (result !== "ok" && result !== "conflict") break;
    response = await send(path, options);
    if (result === "ok") break;
  }
  if (response.status === 204) {
    return null; // e.g. after DELETE: success, nothing to read
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  if (!data) {
    throw new Error("The server returned an invalid response.");
  }
  return data;
}

function fromUser(user) {
  return { id: user.id, name: user.name, email: user.email, isGuest: user.is_guest };
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
const solarPath = (householdId) => `/households/${householdId}/solar`;

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

const alertsPath = (householdId) => `/households/${householdId}/alerts`;

function fromAlert(alert) {
  return {
    id: alert.id,
    category: alert.category,
    rule: alert.rule,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    action: alert.action,
    createdAt: alert.created_at,
    isRead: alert.is_read,
  };
}

function fromAlertRules(data) {
  return {
    rules: data.rules,
    thresholds: {
      dailyLimitKwh: data.thresholds.daily_limit_kwh,
      monthlyBudget: data.thresholds.monthly_budget,
      spikePercent: data.thresholds.unusual_spike_percent,
      solarMinPercent: data.thresholds.solar_minimum_percent_of_expected,
    },
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

function fromLocation(location) {
  return { key: location.key, name: location.name, sunHours: location.sun_hours };
}

function fromRecommendations(data) {
  return {
    location: fromLocation(data.location),
    installBudget: data.install_budget,
    usage: { monthlyKwh: data.usage.monthly_kwh, source: data.usage.source },
    systems: data.systems.map((system) => ({
      kw: system.system_kw,
      panelCount: system.panel_count,
      panelWatts: system.panel_watts,
      cost: system.estimated_cost,
      monthlySavings: system.monthly_savings,
      paybackYears: system.payback_years,
      coversPercent: system.covers_percent,
      status: system.status, // "best_fit" | "available" | "over_budget"
    })),
  };
}

function fromSolarAlert(alert) {
  return { id: alert.id, title: alert.title, message: alert.message, date: alert.date };
}

function fromPerformance(data) {
  if (!data) return null;
  return {
    systemKw: data.system_kw,
    weatherSource: data.weather_source,
    week: {
      startDate: data.week.start_date,
      endDate: data.week.end_date,
      days: data.week.days.map((day) => ({
        date: day.date,
        weekday: day.weekday,
        actualKwh: day.actual_kwh,
        expectedKwh: day.expected_kwh,
        percentOfExpected: day.percent_of_expected,
        isFuture: day.is_future,
        lowOutput: day.low_output,
      })),
    },
    today: {
      generatedKwh: data.today.generated_kwh,
      expectedKwh: data.today.expected_kwh,
      percentOfExpected: data.today.percent_of_expected,
    },
    savedThisMonth: {
      amount: data.saved_this_month.amount,
      billReducedPercent: data.saved_this_month.bill_reduced_percent,
    },
    alerts: data.alerts.map(fromSolarAlert),
  };
}

function fromSolarProfile(profile) {
  return {
    locationKey: profile.location.key,
    installBudget: profile.install_budget,
    systemKw: profile.system_kw,
    panelWatts: profile.panel_watts,
  };
}

const scanSessionPath = (code) => `/scan-sessions/${encodeURIComponent(code)}`;

function photoForm(photo) {
  const form = new FormData();
  form.append("photo", photo, "label.jpg");
  return form;
}

function fromScanSession(session) {
  return { code: session.code, expiresAt: session.expires_at };
}

export const api = {
  health: () => request("/health"),
  listHouseholds: () => request("/households"),
  createHousehold: (data) => request("/households", {
    method: "POST", body: JSON.stringify(data),
  }),
  createHouseholdInvite: (id) => request(`/households/${id}/invites`, { method: "POST" }),
  joinHousehold: (pin) => request("/households/join", {
    method: "POST", body: JSON.stringify({ pin }),
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

  getSolar: async (householdId, weekOf, options) => {
    const query = weekOf ? `?week_of=${encodeURIComponent(weekOf)}` : "";
    const data = await request(`${solarPath(householdId)}${query}`, options);
    return {
      profile: fromSolarProfile(data.profile),
      locations: data.locations.map(fromLocation),
      recommendations: fromRecommendations(data.recommendations),
      mySystem: fromPerformance(data.my_system),
    };
  },
  // profile may hold any of { locationKey, installBudget, systemKw }
  saveSolarProfile: async (householdId, profile) => {
    const body = {};
    if ("locationKey" in profile) body.location_key = profile.locationKey;
    if ("installBudget" in profile) body.install_budget = profile.installBudget;
    if ("systemKw" in profile) body.system_kw = profile.systemKw;
    const data = await request(`${solarPath(householdId)}/profile`, {
      method: "PUT", body: JSON.stringify(body),
    });
    return fromSolarProfile(data.item);
  },
  getSolarRecommendations: async (householdId, options) => {
    const data = await request(`${solarPath(householdId)}/recommendations`, options);
    return fromRecommendations(data);
  },
  // reading is { date, generationKwh, selfConsumedKwh (optional) }
  logSolarReading: (householdId, reading) => request(`${solarPath(householdId)}/readings`, {
    method: "POST",
    body: JSON.stringify({
      date: reading.date,
      generation_kwh: reading.generationKwh,
      self_consumed_kwh: reading.selfConsumedKwh,
    }),
  }),

  // The server only creates alerts when asked, so refresh before listing them.
  refreshAlerts: (householdId) => request(`${alertsPath(householdId)}/refresh`, {
    method: "POST", body: "{}",
  }),
  listAlerts: async (householdId, category, options) => {
    const data = await request(`${alertsPath(householdId)}?category=${category}`, options);
    return { items: data.items.map(fromAlert), counts: data.counts, unreadCount: data.unread_count };
  },
  markAlertRead: (householdId, id) => request(`${alertsPath(householdId)}/${id}`, {
    method: "PATCH", body: JSON.stringify({ is_read: true }),
  }),
  markAllAlertsRead: async (householdId) => {
    const data = await request(`${alertsPath(householdId)}/mark-all-read`, { method: "POST", body: "{}" });
    return data.updated_count;
  },
  getAlertRules: async (householdId, options) => {
    return fromAlertRules(await request(`${alertsPath(householdId)}/rules`, options));
  },
  updateAlertRules: async (householdId, changes) => {
    return fromAlertRules(await request(`${alertsPath(householdId)}/rules`, {
      method: "PATCH", body: JSON.stringify(changes),
    }));
  },

  // Scanning a rating label: the server's vision model returns { name, type, watts }.
  readLabel: (photo) => request("/scans/read", { method: "POST", body: photoForm(photo) }),
  startScanSession: async () => fromScanSession(await request("/scan-sessions", { method: "POST", body: "{}" })),
  getScanSession: (code, options) => request(scanSessionPath(code), options),
  sendScanPhoto: (code, photo) => request(`${scanSessionPath(code)}/photo`, {
    method: "POST", body: photoForm(photo),
  }),

  // Login: the server keeps the tokens in cookies and returns only { user }.
  me: async (options) => fromUser((await request("/auth/me", options)).user),
  // A guest has no name, email or password. Registering later keeps their data.
  guest: async () => fromUser((await request("/auth/guest", { method: "POST", body: "{}" })).user),
  login: async (credentials) => fromUser((await request("/auth/login", {
    method: "POST", body: JSON.stringify(credentials),
  })).user),
  register: async (account) => fromUser((await request("/auth/register", {
    method: "POST", body: JSON.stringify(account),
  })).user),
  // Logout reads the refresh token, so it needs the refresh CSRF value.
  logout: () => request("/auth/logout", {
    method: "POST", headers: { "X-CSRF-TOKEN": readCookie("csrf_refresh_token") },
  }),
};
