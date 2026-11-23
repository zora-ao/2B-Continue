import { useState } from "react";
import { api } from "@/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Asks for a household's name, electricity rate and monthly budget.
export default function HouseholdDialog({ open, onOpenChange, first, opener, onCreated, onJoin }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // There's no DialogTrigger (the dialog can open by itself), so Radix can't return focus.
  // Send it back to the button that opened it (opener), or to the page if there is none.

  function returnFocus(event) {
    event.preventDefault();
    const target = opener.current?.isConnected && opener.current !== document.body
      ? opener.current
      : document.getElementById("main");
    target?.focus();
  }

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
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        setError("");
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        onCloseAutoFocus={returnFocus}
      >
        <DialogHeader>
          <DialogTitle>{first ? "Set up your household" : "Add a household"}</DialogTitle>
          <DialogDescription>
            Your electricity rate is used to work out what each appliance costs.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="household-name">Household name</Label>
              <Input id="household-name" name="name" maxLength={120} required placeholder="My home"
                autoComplete="off" autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="household-rate">Electricity rate (PHP/kWh)</Label>
              <Input id="household-rate" name="electricity_rate" type="number" inputMode="decimal"
                min="0.0001" max="99999999.9999" step="0.0001" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="household-budget">Monthly budget (PHP)</Label>
              <Input id="household-budget" name="monthly_budget" type="number" inputMode="decimal"
                min="0" max="9999999999.99" step="0.01" required />
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              {onJoin && <Button type="button" variant="outline" onClick={onJoin}>Join with PIN</Button>}
              <Button type="submit">{busy ? "Saving..." : "Save household"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
