import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import HouseholdPicker from "@/components/HouseholdPicker";
import NoHousehold from "@/components/NoHousehold";
import PageHeader from "@/components/PageHeader";
import PageSkeleton from "@/components/PageSkeleton";
import { useHouseholds } from "@/hooks/useHouseholds";
import ApplianceForm from "./ApplianceForm";
import ApplianceList from "./ApplianceList";

export default function AppliancesPage() {
  const households = useHouseholds();
  const { householdId } = households;
  const [appliances, setAppliances] = useState([]);
  const [period, setPeriod] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPeriod(null);
    setAppliances([]);
    setEditing(null);
    setDeleting(null);
    api.listAppliances(householdId, { signal: controller.signal }).then((data) => {
      if (controller.signal.aborted) return;
      setAppliances(data.items);
      setPeriod({ rate: data.electricity_rate, days: data.days_in_month, month: data.month });
    }).catch((err) => { if (err.name !== "AbortError") setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [householdId, reload]);

  async function handleSubmit(applianceData) {
    setBusy(true);
    setError("");
    try {
      const saved = await api.saveAppliance(householdId, applianceData, editing?.id, period.month);
      setAppliances((items) => editing
        ? items.map((item) => item.id === saved.id ? saved : item)
        : [...items, saved]);
      setEditing(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally { setBusy(false); }
  }

  async function confirmDelete(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api.deleteAppliance(householdId, deleting.id);
      setAppliances((items) => items.filter((item) => item.id !== deleting.id));
      if (editing?.id === deleting.id) setEditing(null);
      setDeleting(null);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const isLoading = households.loading || loading;
  const loadError = households.error || error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appliances"
        subtitle="Type in your appliances to see how much each one costs."
      />

      <HouseholdPicker
        households={households.households}
        value={householdId}
        onChange={households.setHouseholdId}
        disabled={busy || isLoading}
      />
      {period && !isLoading && (
        <p className="text-sm text-muted-foreground">PHP {period.rate}/kWh | {period.month} ({period.days} days)</p>
      )}

      {loadError && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger p-4 text-danger">
          {loadError}
          {!period && (
            <Button variant="outline" disabled={busy}
              onClick={() => (households.error ? households.reload() : setReload((value) => value + 1))}>
              Retry loading
            </Button>
          )}
        </div>
      )}
      {isLoading && <PageSkeleton variant="appliances" label="Loading appliances..." />}
      {!isLoading && !households.error && households.households.length === 0 && <NoHousehold />}
      {period && !isLoading && <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full lg:w-[400px] lg:shrink-0">
          <ApplianceForm
            editing={editing}
            busy={busy}
            rate={period.rate}
            days={period.days}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <ApplianceList
            appliances={appliances}
            busy={busy}
            onEdit={(appliance) => { setError(""); setEditing(appliance); }}
            onDelete={(appliance) => { setError(""); setDeleting(appliance); }}
          />
        </div>
      </div>}

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from your appliance list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p role="alert" className="text-danger">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={busy} onClick={confirmDelete}>
              {busy ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
