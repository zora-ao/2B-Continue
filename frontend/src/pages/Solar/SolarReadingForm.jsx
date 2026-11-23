import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseKwh, todayIso } from "@/lib/dashboard";

export default function SolarReadingForm({ onSave, onCancel, busy }) {
  const [date, setDate] = useState(todayIso());
  const [generationText, setGenerationText] = useState("");
  const [selfUseText, setSelfUseText] = useState("");
  const [touched, setTouched] = useState(false);

  const generationKwh = parseKwh(generationText);
  const selfConsumedKwh = parseKwh(selfUseText);
  const selfUseInvalid = selfUseText.trim() !== "" && selfConsumedKwh === null;
  const selfUseTooHigh = selfConsumedKwh !== null && generationKwh !== null && selfConsumedKwh > generationKwh;

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (!date || generationKwh === null || selfUseInvalid || selfUseTooHigh) return;
    onSave({ date, generationKwh, selfConsumedKwh });
  }

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="font-heading text-lg font-semibold">Add solar reading</CardTitle>
        <CardDescription>
          Read the day's total from your inverter app or display. Logging a date again replaces it.
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="solar-date">Date</Label>
              <Input
                id="solar-date"
                type="date"
                max={todayIso()}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="solar-generation">Generated (kWh)</Label>
              <Input
                id="solar-generation"
                type="number"
                min="0"
                step="0.1"
                placeholder="8.4"
                value={generationText}
                aria-invalid={touched && generationKwh === null}
                onChange={(event) => setGenerationText(event.target.value)}
              />
              {touched && generationKwh === null && (
                <p className="text-sm text-danger">Enter 0 kWh or more (up to 3 decimals)</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="solar-self-use">Used at home (kWh, optional)</Label>
              <Input
                id="solar-self-use"
                type="number"
                min="0"
                step="0.1"
                placeholder="Same as generated"
                value={selfUseText}
                aria-invalid={touched && (selfUseInvalid || selfUseTooHigh)}
                onChange={(event) => setSelfUseText(event.target.value)}
              />
              {touched && selfUseInvalid && (
                <p className="text-sm text-danger">Enter 0 kWh or more (up to 3 decimals)</p>
              )}
              {touched && selfUseTooHigh && (
                <p className="text-sm text-danger">Can't be more than what was generated</p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save reading"}
            </Button>
            <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
