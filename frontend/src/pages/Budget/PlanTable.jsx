import { Lock, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/appliances";
import { planTotals } from "@/lib/budget";
import { dailyKwh, formatKwh, formatNumber, formatPeso, monthlyCost } from "@/lib/energy";
import { cn } from "@/lib/utils";

// Right column: suggested hours for each appliance, with − / + to adjust.
//   plan          – appliances with hoursPerDay (suggested) and originalHours
//   onHoursChange – called with (id, newHours)
export default function PlanTable({ plan, budget, rate, days, onHoursChange, busy }) {
  const totals = planTotals(plan, rate, days);
  const fitsBudget = totals.costPerMonth <= budget;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg">Your daily plan</CardTitle>
          <CardDescription>
            Recommended hours per day to stay within {formatPeso(budget)}
          </CardDescription>
        </div>
        {plan.length > 0 && (
          <Badge variant={fitsBudget ? "success" : "danger"}>
            {fitsBudget ? "Fits budget" : "Over budget"}
          </Badge>
        )}
      </CardHeader>

      <CardContent>
        {plan.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
            No appliances yet. Add them on the Appliances page first.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-secondary text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <th className="rounded-l-lg px-2 py-2.5 font-medium">Appliance</th>
                  <th className="px-2 py-2.5 font-medium">Power</th>
                  <th className="px-2 py-2.5 font-medium">Hours / day</th>
                  <th className="px-2 py-2.5 font-medium">kWh / day</th>
                  <th className="rounded-r-lg px-2 py-2.5 font-medium">₱ / month</th>
                </tr>
              </thead>
              <tbody>
                {plan.map((appliance) => (
                  <PlanRow
                    key={appliance.id}
                    appliance={appliance}
                    rate={rate}
                    days={days}
                    onHoursChange={onHoursChange}
                    busy={busy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {plan.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 pt-4">
            <span className="font-heading text-base">Total</span>
            <span className="font-heading text-base">
              {formatKwh(totals.kwhPerDay)} / day ·{" "}
              <span className={fitsBudget ? "text-green" : "text-danger"}>
                {formatPeso(totals.costPerMonth)} / month
              </span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// One appliance row. Rows the plan trimmed are highlighted.
function PlanRow({ appliance, rate, days, onHoursChange, busy }) {
  const TypeIcon = getTypeIcon(appliance.type);
  const hours = appliance.hoursPerDay;
  const wasTrimmed = hours < appliance.originalHours;

  return (
    <tr className={cn("border-b border-border last:border-0", wasTrimmed && "bg-warning-soft")}>
      <td className="px-2 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
            <TypeIcon className="size-4" />
          </div>
          <span className="font-medium">
            {appliance.name}
            {appliance.quantity > 1 && ` (×${appliance.quantity})`}
          </span>
          {appliance.isMustHave && (
            <Lock className="size-4 text-green" aria-label="Must-have" />
          )}
        </div>
      </td>
      <td className="px-2 py-3">{appliance.watts} W</td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`Fewer hours for ${appliance.name}`}
            disabled={busy || hours <= 0}
            onClick={() => onHoursChange(appliance.id, Math.max(0, hours - 0.5))}
          >
            <Minus />
          </Button>
          <span className="w-10 text-center">{hours} h</span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`More hours for ${appliance.name}`}
            disabled={busy || hours >= 24}
            onClick={() => onHoursChange(appliance.id, Math.min(24, hours + 0.5))}
          >
            <Plus />
          </Button>
          {wasTrimmed && (
            <span className="text-xs text-warning">was {appliance.originalHours}h</span>
          )}
        </div>
      </td>
      <td className="px-2 py-3">{formatNumber(dailyKwh(appliance))}</td>
      <td className="px-2 py-3">{formatPeso(monthlyCost(appliance, rate, days))}</td>
    </tr>
  );
}
