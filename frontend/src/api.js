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
};
