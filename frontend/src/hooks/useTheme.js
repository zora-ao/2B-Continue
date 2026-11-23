import { useEffect, useState } from "react";

const THEME_KEY = "energywise.theme";

// Default theme is light; dark mode is persisted in localStorage and applied via <html class="dark">.
export function useTheme() {
  const [theme, setTheme] = useState(readSaved);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  function toggle() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      save(next);
      return next;
    });
  }

  return [theme, toggle];
}

function readSaved() {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function save(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be blocked (private browsing); the theme still toggles for this visit.
  }
}
