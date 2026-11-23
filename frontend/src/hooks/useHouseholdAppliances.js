import { useEffect, useState } from "react";
import { api } from "@/api";

const SAVED_HOUSEHOLD_KEY = "energywise.householdId";

// Loads the households, picks one (the last one used, or the first),
// and loads that household's appliances.
export function useHouseholdAppliances() {
  const [households, setHouseholds] = useState([]);
  const [householdId, setHouseholdId] = useState("");
  const [appliances, setAppliances] = useState([]);
  const [period, setPeriod] = useState(null); // { rate, days, month }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  // 1. Load the households.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .listHouseholds()
      .then(({ items }) => {
        if (cancelled) return;
        setHouseholds(items);
        const saved = readSavedHousehold();
        const match = items.find((household) => String(household.id) === saved);
        const chosen = match ?? items[0];
        setHouseholdId(chosen ? String(chosen.id) : "");
        if (!chosen) setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  // 2. Load the chosen household's appliances.
  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .listAppliances(householdId, { signal: controller.signal })
      .then((data) => {
        setAppliances(data.items);
        setPeriod({ rate: data.electricity_rate, days: data.days_in_month, month: data.month });
        saveHousehold(householdId);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [householdId, reloadCount]);

  const household = households.find((item) => String(item.id) === householdId) ?? null;

  return {
    households,
    household,
    householdId,
    setHouseholdId,
    appliances,
    setAppliances,
    period,
    loading,
    error,
    setError,
    reload: () => setReloadCount((count) => count + 1),
  };
}

// Remembering the household is only a convenience, so storage errors
// (private browsing, blocked storage) are ignored.
function readSavedHousehold() {
  try {
    return localStorage.getItem(SAVED_HOUSEHOLD_KEY);
  } catch {
    return null;
  }
}

function saveHousehold(id) {
  try {
    localStorage.setItem(SAVED_HOUSEHOLD_KEY, id);
  } catch {
    // ignore
  }
}
