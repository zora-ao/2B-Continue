import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "@/api";
import HouseholdPicker from "@/components/HouseholdPicker";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";
import { monthLabel } from "@/lib/dashboard";
import AlertsList from "./AlertsList";
import BudgetSummary from "./BudgetSummary";
import MeterReadingForm from "./MeterReadingForm";
import PowerBreakdown from "./PowerBreakdown";
import StatCards from "./StatCards";
import UsageChart from "./UsageChart";

export default function DashboardPage() {
  const households = useHouseholds();
  const { householdId } = households;

  const [dashboard, setDashboard] = useState(null);
  const [period, setPeriod] = useState("day");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .getDashboard(householdId, period, { signal: controller.signal })
      .then(setDashboard)
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [householdId, period, reloadCount]);

  async function handleSaveReading(reading) {
    setSaving(true);
    setError("");
    try {
      await api.logMeterReading(householdId, reading);
      setShowForm(false);
      setJustSaved(true);
      setReloadCount((count) => count + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openForm() {
    setShowForm(true);
    setJustSaved(false);
  }

  const isLoading = households.loading || (loading && !dashboard);
  const loadError = households.error || (!dashboard && error);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        subtitle={
          dashboard
            ? `${monthLabel(dashboard.month)} · Rate ₱${dashboard.rate.toFixed(2)} / kWh`
            : "See how much power you use and how your budget is doing."
        }
        actions={
          dashboard &&
          !showForm && (
            <Button size="lg" onClick={openForm}>
              <Plus />
              Log meter reading
            </Button>
          )
        }
      />

      <HouseholdPicker
        households={households.households}
        value={householdId}
        onChange={households.setHouseholdId}
        disabled={isLoading || saving}
      />

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger p-4 text-danger">
          {loadError}
          <Button
            variant="outline"
            onClick={() => (households.error ? households.reload() : setReloadCount((count) => count + 1))}
          >
            Retry loading
          </Button>
        </div>
      )}
      {dashboard && error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {justSaved && (
        <p role="status" className="text-green">
          Reading saved.
        </p>
      )}

      {isLoading && <p role="status">Loading your dashboard...</p>}

      {!isLoading && !households.error && households.households.length === 0 && (
        <p className="text-muted-foreground">
          No household yet. Set one up on the{" "}
          <Link to="/appliances" className="text-primary underline">
            Appliances page
          </Link>{" "}
          first.
        </p>
      )}

      {dashboard && !isLoading && (
        <>
          {showForm && (
            <MeterReadingForm
              onSave={handleSaveReading}
              onCancel={() => setShowForm(false)}
              busy={saving}
            />
          )}

          <StatCards dashboard={dashboard} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
            <UsageChart
              chart={dashboard.chart}
              period={period}
              onPeriodChange={setPeriod}
              busy={loading}
            />
            <BudgetSummary budget={dashboard.budget} status={dashboard.status} />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
            <PowerBreakdown items={dashboard.breakdown} />
            <AlertsList alerts={dashboard.alerts} alertCount={dashboard.alertCount} />
          </div>
        </>
      )}
    </div>
  );
}
