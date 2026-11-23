import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatKwh, formatNumber } from "@/lib/energy";
import { weekRangeLabel } from "@/lib/solar";
import { cn } from "@/lib/utils";

export default function PanelChart({ mySystem, onPrevWeek, onNextWeek, canGoNext, onSaveSystem, saving, busy }) {
  const [editing, setEditing] = useState(false);

  if (!mySystem || editing) {
    return (
      <SystemSetup
        currentKw={mySystem?.systemKw}
        saving={saving}
        onCancel={mySystem ? () => setEditing(false) : null}
        onSave={async (kw) => {
          const ok = await onSaveSystem(kw);
          if (ok) setEditing(false);
        }}
      />
    );
  }

  const { days } = mySystem.week;
  const maxKwh = Math.max(1, ...days.map((day) => Math.max(day.actualKwh ?? 0, day.expectedKwh ?? 0))) * 1.1;
  const hasActual = days.some((day) => day.actualKwh !== null);

  return (
    <Card className="h-full gap-5 p-6">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 px-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg font-semibold">
            My panels · {formatNumber(mySystem.systemKw)} kW system{" "}
            <button
              type="button"
              className="ml-1 text-xs font-normal text-primary-text hover:underline"
              onClick={() => setEditing(true)}
            >
              Change
            </button>
          </CardTitle>
          <CardDescription>
            {mySystem.weatherSource === "open_meteo"
              ? "Expected output uses Open-Meteo weather · actual output from your readings"
              : "Weather is unavailable, so expected output uses your location's average sun-hours"}
          </CardDescription>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-yellow" /> Actual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-border" /> Expected
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Button size="icon-sm" variant="ghost" aria-label="Previous week" disabled={busy} onClick={onPrevWeek}>
              <ChevronLeft />
            </Button>
            <span className="min-w-28 text-center">{weekRangeLabel(mySystem.week.startDate, mySystem.week.endDate)}</span>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Next week"
              disabled={busy || !canGoNext}
              onClick={onNextWeek}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 px-0">
        <div className={cn("relative flex-1", busy && "opacity-60")}>
          <div className="flex h-64 items-end gap-3 sm:gap-6">
            {days.map((day) => (
              <DayBars key={day.date} day={day} maxKwh={maxKwh} />
            ))}
          </div>
          {!hasActual && (
            <p className="absolute inset-x-0 top-6 text-center text-sm text-muted-foreground">
              No readings this week. Use “Add reading” to log your panels' output.
            </p>
          )}
        </div>
        <div className="flex gap-3 sm:gap-6">
          {days.map((day) => (
            <span key={day.date} className="flex-1 text-center text-xs text-muted-foreground">
              {day.weekday}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DayBars({ day, maxKwh }) {
  const height = (kwh) => `${(kwh / maxKwh) * 100}%`;
  const label = [
    day.actualKwh !== null ? `Actual ${formatKwh(day.actualKwh)}` : "Not logged",
    day.expectedKwh !== null ? `expected ${formatKwh(day.expectedKwh)}` : null,
    day.percentOfExpected !== null ? `(${formatNumber(day.percentOfExpected)}%)` : null,
  ].filter(Boolean).join(", ");

  return (
    <div className="flex h-full flex-1 items-end justify-center gap-1" title={label} aria-label={`${day.weekday}: ${label}`}>
      <div
        className={cn("w-1/2 max-w-5 rounded-t-md bg-border", day.isFuture && "opacity-50")}
        style={{ height: day.expectedKwh !== null ? height(day.expectedKwh) : 0 }}
      />
      <div
        className={cn("w-1/2 max-w-5 rounded-t-md", day.lowOutput ? "bg-danger" : "bg-yellow")}
        style={{ height: day.actualKwh !== null ? height(day.actualKwh) : 0 }}
      />
    </div>
  );
}

function SystemSetup({ currentKw, onSave, onCancel, saving }) {
  const [text, setText] = useState(currentKw ? String(currentKw) : "");
  const [touched, setTouched] = useState(false);
  const kw = Number(text);
  const valid = text.trim() !== "" && kw > 0 && kw <= 999.999 && /^\d+(\.\d{1,3})?$/.test(text.trim());

  function handleSubmit(event) {
    event.preventDefault();
    setTouched(true);
    if (valid) onSave(kw);
  }

  return (
    <Card className="h-full gap-4 p-6">
      <CardHeader className="px-0">
        <CardTitle className="font-heading text-lg font-semibold">My panels</CardTitle>
        <CardDescription>
          Enter your installed system size to compare your panels' output with what the weather allows.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="system-kw">System size (kW)</Label>
            <Input
              id="system-kw"
              type="number"
              min="0"
              step="0.1"
              placeholder="2"
              value={text}
              aria-invalid={touched && !valid}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : currentKw ? "Save" : "Track my panels"}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" disabled={saving} onClick={onCancel}>
                Cancel
              </Button>
            )}
            {currentKw && (
              <Button
                type="button"
                variant="ghost"
                className="text-danger hover:text-danger"
                disabled={saving}
                onClick={() => onSave(null)}
              >
                Remove
              </Button>
            )}
          </div>
        </form>
        {touched && !valid && (
          <p className="mt-2 text-sm text-danger">Enter a size above 0 kW (up to 3 decimals)</p>
        )}
      </CardContent>
    </Card>
  );
}
