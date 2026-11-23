import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import HouseholdDialog from "@/components/HouseholdDialog";

const SAVED_HOUSEHOLD_KEY = "energywise.householdId";
const HouseholdsContext = createContext(null);

// One list of households for every page, plus the dialog that adds one.
// The dialog opens by itself when there are none yet.
export function HouseholdsProvider({ children }) {
  const [households, setHouseholds] = useState([]);
  const [householdId, setHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  // The button that opened the dialog, so focus can go back to it. None when it opened by itself.
  const opener = useRef(null);

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
        if (items.length === 0) {
          opener.current = null;
          setSetupOpen(true);
        }
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

  function handleCreated(household) {
    setHouseholds((items) => [...items, household]);
    setHouseholdId(String(household.id));
    setSetupOpen(false);
  }

  const value = {
    households,
    householdId,
    setHouseholdId,
    loading,
    error,
    reload: () => setReloadCount((count) => count + 1),
    openSetup: () => {
      opener.current = document.activeElement;
      setSetupOpen(true);
    },
  };

  return (
    <HouseholdsContext.Provider value={value}>
      {children}
      <HouseholdDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        first={households.length === 0}
        opener={opener}
        onCreated={handleCreated}
      />
    </HouseholdsContext.Provider>
  );
}

export function useHouseholds() {
  return useContext(HouseholdsContext);
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
