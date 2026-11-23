import { Route, Routes } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import AppliancesPage from "@/pages/Appliances/AppliancesPage";
import BudgetPage from "@/pages/Budget/BudgetPage";
import Placeholder from "@/pages/Placeholder";

export default function App() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="min-w-0 flex-1 p-8">
        <Routes>
          <Route path="/" element={<Placeholder title="Dashboard" />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/appliances" element={<AppliancesPage />} />
          <Route path="/solar" element={<Placeholder title="Solar" />} />
          <Route path="/alerts" element={<Placeholder title="Alerts" />} />
        </Routes>
      </main>
    </div>
  );
}
