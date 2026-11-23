import { useEffect, useState } from "react";
import { api } from "@/api";

const SAVED_HOUSEHOLD_KEY = "energywise.householdId";

export function useHouseholds() {
  const [households, setHouseholds] = useState([]);
  const [householdId, setHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

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
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadCount]);

  useEffect(() => {
    if (householdId) saveHousehold(householdId);
  }, [householdId]);

  return {
    households,
    householdId,
    setHouseholdId,
    loading,
    error,
    reload: () => setReloadCount((count) => count + 1),
  };
}

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
    // Storage can be blocked (private browsing); remembering is optional.
  }
}
