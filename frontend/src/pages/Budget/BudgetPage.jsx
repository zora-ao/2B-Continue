import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { api } from "@/api";
import HouseholdPicker from "@/components/HouseholdPicker";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";
import { parseBudget } from "@/lib/budget";
import BudgetForm from "./BudgetForm";
import BudgetTips from "./BudgetTips";
import PlanTable from "./PlanTable";

// The Budget Planner: set a monthly budget, let the server plan how many
// hours each appliance should run, adjust it, and save the plan.
// Saving keeps a monthly plan; it does not change the appliances' hours.
export default function BudgetPage() {
  const households = useHouseholds();
  const { householdId } = households;

  const [planner, setPlanner] = useState(null); // { defaults, preview, savedPlan }
  const [plan, setPlan] = useState(null); // the plan on screen
  const [budget, setBudget] = useState(""); // text, like every input
  const [style, setStyle] = useState("balanced");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  // Load the planner for the chosen household.
  // Show this month's saved plan if there is one, otherwise a fresh preview.
  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setJustSaved(false);

    api
      .getBudgetPlanner(householdId, { signal: controller.signal })
      .then((data) => {
        setPlanner(data);
        showPlan(data.savedPlan ? data.savedPlan.plan : data.preview);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [householdId, reloadCount]);

  function showPlan(newPlan) {
    setPlan(newPlan);
    setBudget(String(newPlan.budget));
    setStyle(newPlan.style);
  }

  // Every flexible row's current hours, so the server keeps them.
  function currentAdjustments(changedId, changedHours) {
    return plan.items
      .filter((item) => !item.isMustHave)
      .map((item) => ({
        id: item.id,
        hours: item.id === changedId ? changedHours : item.hoursPerDay,
      }));
  }

  // Runs one server call with the busy flag and error message handled.
  async function run(action) {
    setBusy(true);
    setError("");
    setJustSaved(false);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleGenerate() {
    run(async () => {
      const newPlan = await api.generateBudgetPlan(householdId, {
        month: plan.month,
        budget: parseBudget(budget),
        style,
        adjustments: [],
      });
      showPlan(newPlan);
    });
  }

  function handleHoursChange(id, hours) {
    run(async () => {
      const newPlan = await api.generateBudgetPlan(householdId, {
        month: plan.month,
        budget: plan.budget,
        style: plan.style,
        adjustments: currentAdjustments(id, hours),
      });
      setPlan(newPlan);
    });
  }

  function handleSave() {
    run(async () => {
      const savedPlan = await api.saveBudgetPlan(householdId, {
        month: plan.month,
        budget: plan.budget,
        style: plan.style,
        adjustments: currentAdjustments(),
      });
      setPlanner({ ...planner, savedPlan });
      showPlan(savedPlan.plan);
      setJustSaved(true);
    });
  }

  // Back to the household's budget and a fresh balanced plan (unsaved).
  function handleReset() {
    setError("");
    setJustSaved(false);
    showPlan(planner.preview);
  }

  const isLoading = households.loading || loading;
  const loadError = households.error || (!plan && error);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Budget Planner"
        subtitle="Set a monthly budget and we'll plan which appliances to use, and for how long."
        actions={
          plan && (
            <>
              <Button variant="outline" size="lg" disabled={busy} onClick={handleReset}>
                Reset
              </Button>
              <Button size="lg" disabled={busy || plan.items.length === 0} onClick={handleSave}>
                <Check />
                {busy ? "Working..." : "Save plan"}
              </Button>
            </>
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
      {plan && error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}

      {isLoading && <p role="status">Loading your budget plan...</p>}

      {!isLoading && !households.error && households.households.length === 0 && (
        <p className="text-muted-foreground">
          No household yet. Set one up on the{" "}
          <Link to="/appliances" className="text-primary underline">
            Appliances page
          </Link>{" "}
          first.
        </p>
      )}

      {plan && !isLoading && (
        <>
          <SavedPlanStatus savedPlan={planner.savedPlan} justSaved={justSaved} />

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="w-full lg:w-[360px] lg:shrink-0">
              <BudgetForm
                budget={budget}
                onBudgetChange={setBudget}
                rate={plan.rate}
                days={plan.days}
                style={style}
                onStyleChange={setStyle}
                onGenerate={handleGenerate}
                busy={busy}
              />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <PlanTable plan={plan} onHoursChange={handleHoursChange} busy={busy} />
              <BudgetTips tips={plan.tips} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// One line about this month's saved plan.
function SavedPlanStatus({ savedPlan, justSaved }) {
  if (justSaved) {
    return (
      <p role="status" className="text-green">
        Plan saved for this month.
      </p>
    );
  }
  if (!savedPlan) {
    return null;
  }
  if (savedPlan.isStale) {
    return (
      <p role="status" className="text-warning">
        Your appliances or household changed since this plan was saved. Generate and save
        again to update it.
      </p>
    );
  }
  const savedOn = new Date(savedPlan.updatedAt).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
  return <p className="text-muted-foreground">Showing your saved plan from {savedOn}.</p>;
}
