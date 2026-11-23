// Thin wrapper around fetch for talking to the Flask API.
async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

export const api = {
  health: () => request("/health"),
  listItems: () => request("/items"),
  createItem: (text) =>
    request("/items", { method: "POST", body: JSON.stringify({ text }) }),
};
