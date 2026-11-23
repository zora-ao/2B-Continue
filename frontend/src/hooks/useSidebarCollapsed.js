import { useState } from "react";

const SIDEBAR_KEY = "energywise.sidebarCollapsed";

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(readSaved);

  function toggle() {
    setCollapsed((value) => {
      save(!value);
      return !value;
    });
  }

  return [collapsed, toggle];
}

function readSaved() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function save(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage can be blocked (private browsing); the sidebar still toggles for this visit.
  }
}
