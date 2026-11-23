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
      <Sidebar />

      <main className="min-w-0 flex-1 p-4 md:p-8">
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
