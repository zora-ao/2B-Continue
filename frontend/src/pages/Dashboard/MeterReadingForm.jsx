import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseKwh, todayIso } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const READING_KINDS = [
  { value: "consumption", label: "Usage for the day", hint: "How many kWh you used on that day." },
  { value: "meter", label: "Meter counter", hint: "The number on your meter. Log it every day to get daily usage." },
];

export default function MeterReadingForm({ onSave, onCancel, busy }) {
  const [date, setDate] = useState(todayIso());
  const [kind, setKind] = useState("consumption");
  const [kwhText, setKwhText] = useState("");
  const [touched, setTouched] = useState(false);

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
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Log meter reading</CardTitle>
        <CardDescription>Logging a date again replaces that day's reading.</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div
              role="group"
              aria-label="Reading type"
              className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1 sm:w-fit"
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
            <p className="text-sm text-muted-foreground">{kindHint}</p>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
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
                min="0"
                step="0.1"
                placeholder={kind === "meter" ? "12345.6" : "5.3"}
                value={kwhText}
                aria-invalid={touched && kwh === null}
                aria-describedby={touched && kwh === null ? "reading-kwh-error" : undefined}
                onChange={(event) => setKwhText(event.target.value)}
              />
              {touched && kwh === null && (
                <p id="reading-kwh-error" className="text-sm text-danger">Enter 0 kWh or more (up to 3 decimals)</p>
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
