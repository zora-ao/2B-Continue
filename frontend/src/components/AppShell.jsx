import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import LoginCheck from "@/components/LoginCheck";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { HouseholdsProvider, useHouseholds } from "@/hooks/useHouseholds";
import { ToastProvider } from "@/hooks/useToast";

function HouseholdOutlet() {
  const { householdId } = useHouseholds();
  const { pathname } = useLocation();
  // Keyed by page so each one fades in when you navigate to it.
  return (
    <div
      key={pathname}
      className="animate-in fade-in slide-in-from-bottom-2 duration-250 ease-out motion-reduce:animate-none"
    >
      <Outlet key={householdId} />
    </div>
  );
}

// Layout for every app page. Everyone has a session (a guest at least) once the check is done.
export default function AppShell() {
  const { user, retry } = useAuth();

  if (user === undefined) return <LoginCheck />;
  if (user === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
        <title>Can't connect | Kuryenta</title>
        <h1 className="font-heading text-2xl font-bold">Can't connect to Kuryenta</h1>
        <p role="alert" className="text-muted-foreground">
          Check your internet connection, then try again.
        </p>
        <Button onClick={retry}>Try again</Button>
      </main>
    );
  }

  return (
    // A new user (log in, log out) starts over with their own households.
    <ToastProvider>
      <HouseholdsProvider key={user.id}>
        <div className="flex min-h-screen flex-col md:flex-row">
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <Sidebar />

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 p-4 outline-none md:p-8">
            <HouseholdOutlet />
          </main>
        </div>
      </HouseholdsProvider>
    </ToastProvider>
  );
}
