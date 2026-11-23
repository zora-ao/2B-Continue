import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/api";

const AuthContext = createContext(null);

// user: undefined while checking, null when logged out, { id, name, email } when logged in.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const controller = new AbortController();
    api
      .me({ signal: controller.signal })
      .then(setUser)
      .catch((error) => {
        if (error.name !== "AbortError") setUser(null);
      });

    // api.js fires this when a login can no longer be refreshed.
    const handleExpired = () => setUser(null);
    window.addEventListener("auth:expired", handleExpired);
    return () => {
      controller.abort();
      window.removeEventListener("auth:expired", handleExpired);
    };
  }, []);

  const value = {
    user,
    login: async (credentials) => setUser(await api.login(credentials)),
    register: async (account) => setUser(await api.register(account)),
    // Throws if the server can't be reached, so the caller can say so instead of pretending.
    logout: async () => {
      await api.logout();
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
