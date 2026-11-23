import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api } from "@/api";

const AuthContext = createContext(null);

// Who is using the app. Without a login, the server makes a guest so the app works right away.
async function loadUser(signal) {
  try {
    return await api.me({ signal });
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  return api.guest();
}

// user: undefined while checking, null if the server can't be reached,
// otherwise { id, name, email, isGuest }.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  // A first visit's 401 also fires auth:expired; that must not start a second guest.
  const starting = useRef(0); // sessions being started right now

  const startSession = useCallback((signal) => {
    starting.current += 1;
    setUser(undefined);
    return loadUser(signal)
      .then(setUser)
      .catch((error) => {
        if (error.name !== "AbortError") setUser(null);
      })
      .finally(() => {
        starting.current -= 1;
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    startSession(controller.signal);

    // api.js fires this when a login can no longer be refreshed: carry on as a new guest.
    const handleExpired = () => {
      if (starting.current === 0) startSession();
    };
    window.addEventListener("auth:expired", handleExpired);
    return () => {
      controller.abort();
      window.removeEventListener("auth:expired", handleExpired);
    };
  }, [startSession]);

  const value = {
    user,
    retry: () => startSession(),
    login: async (credentials) => setUser(await api.login(credentials)),
    register: async (account) => setUser(await api.register(account)),
    // Throws if the server can't be reached, so the caller can say so instead of pretending.
    logout: async () => {
      await api.logout();
      setUser(await api.guest().catch(() => null));
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
