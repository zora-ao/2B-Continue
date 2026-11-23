import { Route, Routes } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AlertsPage from "@/pages/Alerts/AlertsPage";
import AppliancesPage from "@/pages/Appliances/AppliancesPage";
import BudgetPage from "@/pages/Budget/BudgetPage";
import DashboardPage from "@/pages/Dashboard/DashboardPage";
import ScanPhotoPage from "@/pages/Scan/ScanPhotoPage";
import SolarPage from "@/pages/Solar/SolarPage";

export default function App() {
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
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/appliances" element={<AppliancesPage />} />
          <Route path="/solar" element={<SolarPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route path="/scan/:code" element={<ScanPhotoPage />} />
        </Routes>
      </main>
    </div>
  );
}
