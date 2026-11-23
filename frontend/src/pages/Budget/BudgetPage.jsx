import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "@/api";
import HouseholdPicker from "@/components/HouseholdPicker";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useHouseholdAppliances } from "@/hooks/useHouseholdAppliances";
import { makePlan } from "@/lib/budget";
import BudgetForm from "./BudgetForm";
import BudgetTips from "./BudgetTips";
import PlanTable from "./PlanTable";

// The Budget Planner: set a monthly budget, generate a plan of how many
// hours each appliance should run, adjust it, and save the new hours.
export default function BudgetPage() {
  const {
    households,
    household,
    householdId,
    setHouseholdId,
    appliances,
    setAppliances,
    period,
    loading,
    error,
    setError,
    reload,
  } = useHouseholdAppliances();

  const [budget, setBudget] = useState(""); // text, like every input
  const [style, setStyle] = useState("balanced");
  const [plan, setPlan] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Start from the household's budget.
  useEffect(() => {
    if (household) setBudget(String(household.monthly_budget));
  }, [household]);

  // Start the plan from the appliances' current hours.
  useEffect(() => {
    setPlan(startingPlan(appliances));
  }, [appliances]);

  function handleGenerate() {
    setPlan(makePlan(appliances, Number(budget), period.rate, period.days, style));
    setSaved(false);
  }

  function handleReset() {
    setPlan(startingPlan(appliances));
    setSaved(false);
  }

  function handleHoursChange(id, hours) {
    setPlan(plan.map((item) => (item.id === id ? { ...item, hoursPerDay: hours } : item)));
    setSaved(false);
  }

  // Saves only the appliances whose hours changed.
  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const changed = plan.filter((item) => item.hoursPerDay !== item.originalHours);
      const updated = [...appliances];
      for (const item of changed) {
        const savedItem = await api.saveAppliance(householdId, item, item.id, period.month);
        const index = updated.findIndex((appliance) => appliance.id === savedItem.id);
        updated[index] = savedItem;
      }
      setAppliances(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasChanges = plan.some((item) => item.hoursPerDay !== item.originalHours);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Budget Planner"
        subtitle="Set a monthly budget and we'll plan which appliances to use, and for how long."
        actions={
          period && (
            <>
              <Button variant="outline" size="lg" disabled={!hasChanges || saving} onClick={handleReset}>
                Reset
              </Button>
              <Button size="lg" disabled={!hasChanges || saving} onClick={handleSave}>
                <Check />
                {saving ? "Saving..." : "Save plan"}
              </Button>
            </>
          )
        }
      />

      <HouseholdPicker
        households={households}
        value={householdId}
        onChange={setHouseholdId}
        disabled={loading || saving}
      />

      {error && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-danger p-4 text-danger">
          {error}
          {!period && (
            <Button variant="outline" onClick={reload}>
              Retry loading
            </Button>
          )}
        </div>
      )}
      {saved && !hasChanges && (
        <p role="status" className="text-green">
          Plan saved. Your appliances now use the new hours.
        </p>
      )}

      {loading && <p role="status">Loading your appliances...</p>}

      {!loading && !error && households.length === 0 && (
        <p className="text-muted-foreground">
          No household yet. Set one up on the{" "}
          <Link to="/appliances" className="text-primary underline">
            Appliances page
          </Link>{" "}
          first.
        </p>
      )}

      {period && !loading && (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="w-full lg:w-[360px] lg:shrink-0">
            <BudgetForm
              budget={budget}
              onBudgetChange={setBudget}
              rate={period.rate}
              days={period.days}
              style={style}
              onStyleChange={setStyle}
              onGenerate={handleGenerate}
              busy={saving}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <PlanTable
              plan={plan}
              budget={Number(budget) || 0}
              rate={period.rate}
              days={period.days}
              onHoursChange={handleHoursChange}
              busy={saving}
            />
            <BudgetTips />
          </div>
        </div>
      )}
    </div>
  );
}

// The plan before any trimming: every appliance at its current hours.
function startingPlan(appliances) {
  return appliances.map((appliance) => ({
    ...appliance,
    originalHours: appliance.hoursPerDay,
  }));
}
