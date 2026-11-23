import { useEffect, useState } from "react";
import { Check, CircleCheck } from "lucide-react";
import { api } from "@/api";
import HouseholdPicker from "@/components/HouseholdPicker";
import NoHousehold from "@/components/NoHousehold";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";
import { ALERT_CATEGORIES } from "@/lib/alerts";
import AlertCard from "./AlertCard";
import AlertRules from "./AlertRules";
import CategoryFilter from "./CategoryFilter";

export default function AlertsPage() {
  const households = useHouseholds();
  const { householdId } = households;

  const [alerts, setAlerts] = useState(null);
  const [settings, setSettings] = useState(null);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    const options = { signal: controller.signal };
    setLoading(true);
    setError("");
    setCategory("all");

    api
      .refreshAlerts(householdId)
      .then(() => Promise.all([api.listAlerts(householdId, "all", options), api.getAlertRules(householdId, options)]))
      .then(([list, rules]) => {
        setAlerts(list);
        setSettings(rules);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [householdId, reloadCount]);

  async function run(action) {
    setBusy(true);
    setError("");
    setStatusMessage("");
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reloadList(nextCategory = category) {
    setAlerts(await api.listAlerts(householdId, nextCategory));
  }

  function handleCategoryChange(nextCategory) {
    setCategory(nextCategory);
    run(() => reloadList(nextCategory));
  }

  function handleMarkRead(id) {
    run(async () => {
      await api.markAlertRead(householdId, id);
      await reloadList();
    });
  }

  function handleMarkAllRead() {
    run(async () => {
      const count = await api.markAllAlertsRead(householdId);
      await reloadList();
      setStatusMessage(count === 1 ? "Marked 1 alert as read." : `Marked ${count} alerts as read.`);
    });
  }

  function handleToggleRule(name, enabled) {
    run(async () => {
      setSettings(await api.updateAlertRules(householdId, { [name]: enabled }));
      await reloadList();
    });
  }

  const isLoading = households.loading || (loading && !alerts);
  const loadError = households.error || (!alerts && error);
  const categoryLabel = ALERT_CATEGORIES.find((option) => option.value === category).label;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts"
        subtitle="Warnings about your budget, usage spikes, wasteful appliances, and solar output."
        actions={
          alerts && (
            <Button variant="outline" size="lg" disabled={busy || alerts.unreadCount === 0} onClick={handleMarkAllRead}>
              <Check />
              Mark all read
            </Button>
          )
        }
      />

      <HouseholdPicker
        households={households.households}
        value={householdId}
        onChange={households.setHouseholdId}
        disabled={isLoading || busy}
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
      {alerts && error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {/* Kept in the page at all times so screen readers announce each new message. */}
      <p role="status" className="text-green empty:hidden">
        {statusMessage}
      </p>

      {isLoading && <PageSkeleton variant="alerts" label="Loading your alerts..." />}

      {!isLoading && !households.error && households.households.length === 0 && (
        <NoHousehold />
      )}

      {alerts && settings && !isLoading && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px] xl:items-start">
          <section aria-label="Alerts" className="flex min-w-0 flex-col gap-4">
            <CategoryFilter category={category} counts={alerts.counts} onChange={handleCategoryChange} />

            {alerts.items.length === 0 && (
              <p className="flex items-center gap-2 rounded-xl border border-border p-5 text-muted-foreground">
                <CircleCheck className="size-5 text-green" />
                {category === "all"
                  ? "No alerts this month. Nice work!"
                  : `No ${categoryLabel.toLowerCase()} alerts this month.`}
              </p>
            )}

            {alerts.items.map((alert) => (
              <AlertCard key={alert.id} alert={alert} onMarkRead={handleMarkRead} busy={busy} />
            ))}
          </section>

          <AlertRules settings={settings} onToggle={handleToggleRule} busy={busy} />
        </div>
      )}
    </div>
  );
}
