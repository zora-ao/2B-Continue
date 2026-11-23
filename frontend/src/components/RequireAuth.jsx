import { Navigate, Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import LoginCheck from "@/components/LoginCheck";
import { useAuth } from "@/hooks/useAuth";

// Layout for every logged-in page: waits for the login check, then shows the app shell.
export default function RequireAuth() {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) return <LoginCheck />;
  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Sidebar />

      <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
