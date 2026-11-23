import { Route, Routes } from "react-router-dom";
import RequireAuth from "@/components/RequireAuth";
import AlertsPage from "@/pages/Alerts/AlertsPage";
import AppliancesPage from "@/pages/Appliances/AppliancesPage";
import BudgetPage from "@/pages/Budget/BudgetPage";
import DashboardPage from "@/pages/Dashboard/DashboardPage";
import ScanPhotoPage from "@/pages/Scan/ScanPhotoPage";
import SolarPage from "@/pages/Solar/SolarPage";

export default function App() {
  return (
    <Routes>
      {/* Opened on a phone from the desktop QR code, so it works without a login. */}
      <Route
        path="/scan/:code"
        element={
          <main className="p-4 md:p-8">
            <ScanPhotoPage />
          </main>
        }
      />

      <Route element={<RequireAuth />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/appliances" element={<AppliancesPage />} />
        <Route path="/solar" element={<SolarPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
      </Route>
    </Routes>
  );
}
