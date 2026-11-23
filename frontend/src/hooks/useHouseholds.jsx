import { createContext, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/api";
import HouseholdDialog from "@/components/HouseholdDialog";
import HouseholdSharingDialog from "@/components/HouseholdSharingDialog";
import DeleteHouseholdDialog from "@/components/DeleteHouseholdDialog";
import { useAuth } from "@/hooks/useAuth";

const SAVED_HOUSEHOLD_KEY = "energywise.householdId";
const HouseholdsContext = createContext(null);

// One list of households for every page, plus the dialog that adds one.
// The dialog opens by itself when there are none yet.
export function HouseholdsProvider({ children }) {
  const { user } = useAuth();
  const [households, setHouseholds] = useState([]);
  const [householdId, setHouseholdId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [setupOpen, setSetupOpen] = useState(false);
  const [sharing, setSharing] = useState(null);
  const [deleting, setDeleting] = useState(null);
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
    setHouseholds((items) => items.some((item) => item.id === household.id) ? items : [...items, household]);
    setHouseholdId(String(household.id));
    setSetupOpen(false);
    setSharing(null);
  }

  function openJoin() {
    opener.current = document.activeElement;
    setSetupOpen(false);
    setSharing({ mode: "join" });
  }

  function handleDeleted(id) {
    const remaining = households.filter((household) => household.id !== id);
    setHouseholds(remaining);
    setHouseholdId(remaining.length ? String(remaining[0].id) : "");
    setDeleting(null);
    setReloadCount((count) => count + 1);
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
    openJoin: user.isGuest ? null : openJoin,
    openDelete: (household) => {
      opener.current = document.activeElement;
      setDeleting(household);
    },
    openShare: user.isGuest ? null : (household) => {
      opener.current = document.activeElement;
      setSharing({ mode: "share", household });
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
        onJoin={user.isGuest ? null : openJoin}
      />
      {sharing && (
        <HouseholdSharingDialog
          {...sharing}
          onClose={() => setSharing(null)}
          onJoined={handleCreated}
          opener={opener}
        />
      )}
      {deleting && (
        <DeleteHouseholdDialog household={deleting} opener={opener}
          onClose={() => setDeleting(null)} onDeleted={handleDeleted} />
      )}
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
