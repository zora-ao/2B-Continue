import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { api } from "@/api";
import HouseholdPicker from "@/components/HouseholdPicker";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";
import { todayIso } from "@/lib/dashboard";
import { formatBudgetInput, parseBudget, shiftDate } from "@/lib/solar";
import PanelChart from "./PanelChart";
import RecommendedSystems from "./RecommendedSystems";
import SolarReadingForm from "./SolarReadingForm";
import SolarStats from "./SolarStats";

const BUDGET_SAVE_DELAY_MS = 600;

export default function SolarPage() {
  const households = useHouseholds();
  const { householdId } = households;

  const [solar, setSolar] = useState(null);
  const [weekOf, setWeekOf] = useState(null); // null = this week
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);

  // Location and budget inputs: edited locally, saved to the profile, then recommendations refresh.
  const [locationKey, setLocationKey] = useState("");
  const [budgetText, setBudgetText] = useState("");
  const [updatingRecommendations, setUpdatingRecommendations] = useState(false);
  const syncedHousehold = useRef(null);
  const budgetTimer = useRef(null);
  const latestProfileSave = useRef(0);

  const [showForm, setShowForm] = useState(false);
  const [savingReading, setSavingReading] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!householdId) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");

    api
      .getSolar(householdId, weekOf, { signal: controller.signal })
      .then((data) => {
        setSolar(data);
        // Fill the inputs once per household, so a week change never overwrites typing.
        if (syncedHousehold.current !== householdId) {
          syncedHousehold.current = householdId;
          setLocationKey(data.profile.locationKey);
          setBudgetText(formatBudgetInput(data.profile.installBudget));
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [householdId, weekOf, reloadCount]);

  // Switching households starts from that household's saved settings and this week.
  useEffect(() => {
    setWeekOf(null);
    setShowForm(false);
    setNotice("");
    clearTimeout(budgetTimer.current);
  }, [householdId]);

  useEffect(() => () => clearTimeout(budgetTimer.current), []);

  async function saveProfileAndRefresh(changes) {
    const saveId = ++latestProfileSave.current;
    setUpdatingRecommendations(true);
    setError("");
    try {
      await api.saveSolarProfile(householdId, changes);
      const recommendations = await api.getSolarRecommendations(householdId);
      // Ignore stale responses when the user changed the inputs again meanwhile.
      if (saveId === latestProfileSave.current) {
        setSolar((current) => current && { ...current, recommendations });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      if (saveId === latestProfileSave.current) setUpdatingRecommendations(false);
    }
  }

  function handleLocationChange(key) {
    setLocationKey(key);
    saveProfileAndRefresh({ locationKey: key });
  }

  function handleBudgetChange(text) {
    setBudgetText(text);
    clearTimeout(budgetTimer.current);
    const budget = parseBudget(text);
    if (!budget.valid) return;
    budgetTimer.current = setTimeout(
      () => saveProfileAndRefresh({ installBudget: budget.value }),
      BUDGET_SAVE_DELAY_MS,
    );
  }

  async function handleSaveSystem(systemKw) {
    setSavingSystem(true);
    setError("");
    try {
      await api.saveSolarProfile(householdId, { systemKw });
      setReloadCount((count) => count + 1);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSavingSystem(false);
    }
  }

  async function handleSaveReading(reading) {
    setSavingReading(true);
    setError("");
    try {
      await api.logSolarReading(householdId, reading);
      setShowForm(false);
      setNotice("Reading saved.");
      setReloadCount((count) => count + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingReading(false);
    }
  }

  const isLoading = households.loading || (loading && !solar);
  const loadError = households.error || (!solar && error);
  const mySystem = solar?.mySystem;
  const canGoNext = Boolean(mySystem) && mySystem.week.endDate < todayIso();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Solar"
        subtitle="Find a system that fits your budget, then track how your panels perform."
        actions={
          solar &&
          !showForm && (
            <Button
              size="lg"
              onClick={() => {
                setShowForm(true);
                setNotice("");
              }}
            >
              <Plus />
              Add reading
            </Button>
          )
        }
      />

      <HouseholdPicker
        households={households.households}
        value={householdId}
        onChange={households.setHouseholdId}
        disabled={isLoading || savingReading || savingSystem}
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
      {solar && error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-green">
          {notice}
        </p>
      )}

      {isLoading && <p role="status">Loading solar...</p>}

      {!isLoading && !households.error && households.households.length === 0 && (
        <p className="text-muted-foreground">
          No household yet. Set one up on the{" "}
          <Link to="/appliances" className="text-primary underline">
            Appliances page
          </Link>{" "}
          first.
        </p>
      )}

      {solar && !isLoading && (
        <>
          {showForm && (
            <SolarReadingForm
              onSave={handleSaveReading}
              onCancel={() => setShowForm(false)}
              busy={savingReading}
            />
          )}

          <RecommendedSystems
            recommendations={solar.recommendations}
            locations={solar.locations}
            locationKey={locationKey}
            onLocationChange={handleLocationChange}
            budgetText={budgetText}
            onBudgetChange={handleBudgetChange}
            budgetValid={parseBudget(budgetText).valid}
            updating={updatingRecommendations}
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
            <PanelChart
              mySystem={mySystem}
              busy={loading}
              canGoNext={canGoNext}
              onPrevWeek={() => setWeekOf(shiftDate(mySystem.week.startDate, -7))}
              onNextWeek={() => {
                const next = shiftDate(mySystem.week.startDate, 7);
                setWeekOf(next > todayIso() ? null : next);
              }}
              onSaveSystem={handleSaveSystem}
              saving={savingSystem}
            />
            {mySystem && <SolarStats mySystem={mySystem} />}
          </div>
        </>
      )}
    </div>
  );
}
