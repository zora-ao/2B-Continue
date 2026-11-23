import { api } from "@/api";
import { Button } from "@/components/ui/button";
import HouseholdSetup from "./HouseholdSetup";
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
import PageHeader from "@/components/PageHeader";
import ApplianceForm from "./ApplianceForm";
import ApplianceList from "./ApplianceList";

export default function AppliancesPage() {
  const [households, setHouseholds] = useState([]);
  const [householdId, setHouseholdId] = useState("");
  const [appliances, setAppliances] = useState([]);
  const [period, setPeriod] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.listHouseholds().then(({ items }) => {
      if (cancelled) return;
      setHouseholds(items);
      let saved;
      try { saved = localStorage.getItem("energywise.householdId"); } catch { /* optional preference */ }
      setHouseholdId((current) => String(items.find((h) => String(h.id) === (current || saved))?.id ?? items[0]?.id ?? ""));
      setReady(true);
    }).catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [reload]);

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
      try { localStorage.setItem("energywise.householdId", householdId); } catch { /* optional preference */ }
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appliances"
        subtitle="Type in your appliances to see how much each one costs."
      />

      {error && (
        <div role="alert" className="rounded-lg border border-danger p-4 text-danger">
          {error} {!period && <Button variant="outline" disabled={busy} onClick={() => setReload((value) => value + 1)}>Retry loading</Button>}
        </div>
      )}
      {ready && households.length > 0 && (
        <label className="flex flex-wrap items-center gap-3 text-sm">
          Household
          <select className="rounded-lg border border-border bg-background p-2" value={householdId}
            disabled={busy || loading} onChange={(event) => setHouseholdId(event.target.value)}>
            {households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          {period && <span className="text-muted-foreground">PHP {period.rate}/kWh | {period.month} ({period.days} days)</span>}
        </label>
      )}
      {loading && <p role="status">Loading appliances...</p>}
      {ready && !loading && households.length === 0 && (
        <HouseholdSetup onCreated={(household) => {
          setHouseholds([household]);
          setHouseholdId(String(household.id));
        }} />
      )}
      {period && !loading && <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
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

      {/* "Are you sure?" dialog for deleting */}
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
