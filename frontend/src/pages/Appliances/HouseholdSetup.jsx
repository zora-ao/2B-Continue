import { useState } from "react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function HouseholdSetup({ onCreated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const { item } = await api.createHousehold({
        name: form.get("name"),
        electricity_rate: form.get("electricity_rate"),
        monthly_budget: form.get("monthly_budget"),
      });
      onCreated(item);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="flex max-w-md flex-col gap-4 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">Set up your household</h2>
      <p className="text-sm text-muted-foreground">Enter your electricity rate to calculate appliance costs.</p>
      <fieldset disabled={busy} className="flex flex-col gap-4">
        <Label htmlFor="household-name">Household name</Label>
        <Input id="household-name" name="name" maxLength={120} required placeholder="My home" />
        <Label htmlFor="household-rate">Electricity rate (PHP/kWh)</Label>
        <Input id="household-rate" name="electricity_rate" type="number" min="0.0001" max="99999999.9999" step="0.0001" required />
        <Label htmlFor="household-budget">Monthly budget (PHP)</Label>
        <Input id="household-budget" name="monthly_budget" type="number" min="0" max="9999999999.99" step="0.01" required />
        <Button type="submit">{busy ? "Saving…" : "Create household"}</Button>
      </fieldset>
      {error && <p role="alert" className="text-danger">{error}</p>}
    </form>
  );
}
