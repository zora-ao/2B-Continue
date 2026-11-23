import { useEffect, useState } from "react";
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
import { parseKwh, todayIso } from "@/lib/dashboard";

export default function SolarReadingForm({ open, onOpenChange, onSave, busy, error }) {
  const [date, setDate] = useState(todayIso());
  const [generationText, setGenerationText] = useState("");
  const [selfUseText, setSelfUseText] = useState("");
  const [touched, setTouched] = useState(false);

  // Start fresh each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setGenerationText("");
    setSelfUseText("");
    setTouched(false);
  }, [open]);

  const generationKwh = parseKwh(generationText);
  const selfConsumedKwh = parseKwh(selfUseText);
  const selfUseInvalid = selfUseText.trim() !== "" && selfConsumedKwh === null;
  const selfUseTooHigh = selfConsumedKwh !== null && generationKwh !== null && selfConsumedKwh > generationKwh;

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (generationKwh === null) document.getElementById("solar-generation")?.focus();
    else if (selfUseInvalid || selfUseTooHigh) document.getElementById("solar-self-use")?.focus();
    if (!date || generationKwh === null || selfUseInvalid || selfUseTooHigh) return;
    onSave({ date, generationKwh, selfConsumedKwh });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (busy) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add solar reading</DialogTitle>
          <DialogDescription>
            Read the day's total from your inverter app or display. Logging a date again replaces it.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder="8.4"
                  value={generationText}
                  autoFocus
                  aria-invalid={touched && generationKwh === null}
                  aria-describedby={touched && generationKwh === null ? "solar-generation-error" : undefined}
                  onChange={(event) => setGenerationText(event.target.value)}
                />
                {touched && generationKwh === null && (
                  <p id="solar-generation-error" className="text-xs text-danger">
                    Enter 0 kWh or more (up to 3 decimals)
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="solar-self-use">Used at home (kWh, optional)</Label>
              <Input
                id="solar-self-use"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                placeholder="Same as generated"
                value={selfUseText}
                aria-invalid={touched && (selfUseInvalid || selfUseTooHigh)}
                aria-describedby={touched && (selfUseInvalid || selfUseTooHigh) ? "solar-self-use-error" : undefined}
                onChange={(event) => setSelfUseText(event.target.value)}
              />
              {touched && selfUseInvalid && (
                <p id="solar-self-use-error" className="text-xs text-danger">
                  Enter 0 kWh or more (up to 3 decimals)
                </p>
              )}
              {touched && selfUseTooHigh && (
                <p id="solar-self-use-error" className="text-xs text-danger">
                  Can't be more than what was generated
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{busy ? "Saving..." : "Save reading"}</Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
