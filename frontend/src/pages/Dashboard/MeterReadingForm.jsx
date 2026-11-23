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
import { cn } from "@/lib/utils";

const READING_KINDS = [
  { value: "consumption", label: "Usage for the day", hint: "How many kWh you used on that day." },
  { value: "meter", label: "Meter counter", hint: "The number on your meter. Log it every day to get daily usage." },
];

export default function MeterReadingForm({ open, onOpenChange, onSave, busy, error }) {
  const [date, setDate] = useState(todayIso());
  const [kind, setKind] = useState("consumption");
  const [kwhText, setKwhText] = useState("");
  const [touched, setTouched] = useState(false);

  // Start fresh each time the modal opens.
  useEffect(() => {
    if (!open) return;
    setDate(todayIso());
    setKind("consumption");
    setKwhText("");
    setTouched(false);
  }, [open]);

  const kwh = parseKwh(kwhText);
  const kindHint = READING_KINDS.find((option) => option.value === kind).hint;

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (kwh === null) document.getElementById("reading-kwh")?.focus();
    if (kwh === null || !date) return;
    onSave({ date, kind, kwh });
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
          <DialogTitle>Log meter reading</DialogTitle>
          <DialogDescription>Logging a date again replaces that day's reading.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div
                role="group"
                aria-label="Reading type"
                className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1"
              >
                {READING_KINDS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    aria-pressed={kind === option.value}
                    variant={kind === option.value ? "default" : "ghost"}
                    className={cn(kind !== option.value && "text-muted-foreground")}
                    onClick={() => setKind(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{kindHint}</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reading-date">Date</Label>
                <Input
                  id="reading-date"
                  type="date"
                  max={todayIso()}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reading-kwh">kWh</Label>
                <Input
                  id="reading-kwh"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  placeholder={kind === "meter" ? "12345.6" : "5.3"}
                  value={kwhText}
                  autoFocus
                  aria-invalid={touched && kwh === null}
                  aria-describedby={touched && kwh === null ? "reading-kwh-error" : undefined}
                  onChange={(event) => setKwhText(event.target.value)}
                />
                {touched && kwh === null && (
                  <p id="reading-kwh-error" className="text-xs text-danger">
                    Enter 0 kWh or more (up to 3 decimals)
                  </p>
                )}
              </div>
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
