import { Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, formatPeso } from "@/lib/energy";
import { USAGE_SOURCE_LABELS, coversText, paybackText } from "@/lib/solar";
import { cn } from "@/lib/utils";

export default function RecommendedSystems({
  recommendations,
  locations,
  locationKey,
  onLocationChange,
  budgetText,
  onBudgetChange,
  budgetValid,
  updating,
}) {
  const { usage, systems } = recommendations;

  return (
    <Card className="gap-5 p-6">
      <CardHeader className="flex flex-col gap-4 px-0 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg font-semibold">Recommended systems</CardTitle>
          <CardDescription title={sourceText(usage)}>{basisText(usage)}</CardDescription>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="solar-location" className="text-xs tracking-wide text-muted-foreground uppercase">
              Location
            </Label>
            <Select value={locationKey} onValueChange={onLocationChange}>
              <SelectTrigger id="solar-location" className="min-w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.key} value={location.key}>
                    {location.name} · {formatNumber(location.sunHours)} sun-hours
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="solar-budget" className="text-xs tracking-wide text-muted-foreground uppercase">
              Install budget
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
                ₱
              </span>
              <Input
                id="solar-budget"
                inputMode="decimal"
                placeholder="No limit"
                className="min-w-48 pl-7"
                value={budgetText}
                aria-invalid={!budgetValid}
                onChange={(event) => onBudgetChange(event.target.value)}
              />
            </div>
            {!budgetValid && <p className="text-xs text-danger">Enter an amount like 150,000</p>}
          </div>
        </div>
      </CardHeader>

      <CardContent
        className={cn("grid grid-cols-1 gap-4 px-0 md:grid-cols-3", updating && "opacity-60 transition-opacity")}
        aria-busy={updating}
      >
        {systems.map((system) => (
          <SystemCard key={system.kw} system={system} />
        ))}
      </CardContent>
    </Card>
  );
}

function basisText(usage) {
  if (usage.monthlyKwh === null) {
    return "Log meter readings or add appliances so we can size a system for your usage.";
  }
  return `Based on ${Math.round(usage.monthlyKwh)} kWh/month usage, your location, and your install budget`;
}

function sourceText(usage) {
  const source = USAGE_SOURCE_LABELS[usage.source];
  return source ? `Monthly usage comes from ${source}.` : undefined;
}

function SystemCard({ system }) {
  const isBest = system.status === "best_fit";
  const isOver = system.status === "over_budget";

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-5",
        isBest ? "border-yellow bg-yellow-soft" : "border-border bg-background/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              isBest ? "bg-yellow text-background" : "bg-secondary text-yellow",
            )}
          >
            <Sun className="size-4" />
          </div>
          <div>
            <p className="font-heading text-xl font-bold">{formatNumber(system.kw)} kW</p>
            <p className="text-xs text-muted-foreground">
              {system.panelCount} × {system.panelWatts} W panels
            </p>
          </div>
        </div>
        {isBest && <Badge variant="solar">Best fit</Badge>}
        {isOver && <Badge variant="danger">Over budget</Badge>}
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <Row label="Est. cost" value={formatPeso(system.cost)} />
        <Row label="Monthly savings" value={`${formatPeso(system.monthlySavings)} / mo`} />
        <Row label="Payback" value={paybackText(system.paybackYears)} />
        <Row label="Covers" value={coversText(system)} />
      </dl>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
