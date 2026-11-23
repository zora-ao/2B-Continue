import { Lock, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/appliances";
import { roundHours } from "@/lib/budget";
import { formatKwh, formatNumber, formatPeso } from "@/lib/energy";
import { cn } from "@/lib/utils";

export default function PlanTable({ plan, onHoursChange, busy }) {
  const hasItems = plan.items.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg">Your daily plan</CardTitle>
          <CardDescription>
            Recommended hours per day to stay within {formatPeso(plan.budget)}
          </CardDescription>
        </div>
        {hasItems && (
          <Badge variant={plan.fitsBudget ? "success" : "danger"}>
            {plan.fitsBudget ? "Fits budget" : "Over budget"}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {plan.warnings.map((warning) => (
          <p key={warning} role="alert" className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            {warning}
          </p>
        ))}

        {hasItems && (
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
                {plan.items.map((item) => (
                  <PlanRow key={item.id} item={item} onHoursChange={onHoursChange} busy={busy} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {hasItems && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 pt-4">
            <span className="font-heading text-base">Total</span>
            <span className="font-heading text-base">
              {formatKwh(plan.totals.dailyKwh)} / day ·{" "}
              <span className={plan.fitsBudget ? "text-green" : "text-danger"}>
                {formatPeso(plan.totals.monthlyCost)} / month
              </span>
            </span>
          </div>
        )}
        {hasItems && plan.totals.savings > 0 && (
          <p className="px-2 text-sm text-muted-foreground">
            Saves about {formatPeso(plan.totals.savings)} a month compared with your current usage.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PlanRow({ item, onHoursChange, busy }) {
  const TypeIcon = getTypeIcon(item.type);
  const hours = item.hoursPerDay;
  const minimum = item.isMustHave ? Math.min(0.5, item.maxHoursPerDay) : 0;

  return (
    <tr className={cn("border-b border-border last:border-0", item.isReduced && "bg-warning-soft")}>
      <td className="px-2 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-secondary">
            <TypeIcon className="size-4" />
          </div>
          <span className="font-medium">
            {item.name}
            {item.quantity > 1 && ` (×${item.quantity})`}
          </span>
          {item.isMustHave && <Lock className="size-4 text-green" aria-label="Must-have, protected from automatic cuts" />}
        </div>
      </td>
      <td className="px-2 py-3">{formatNumber(item.watts)} W</td>
      <td className="px-2 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`Fewer hours for ${item.name}`}
            disabled={busy || hours <= minimum}
            onClick={() => onHoursChange(item.id, roundHours(Math.max(minimum, hours - 0.5)))}
          >
            <Minus />
          </Button>
          <span className="w-12 text-center">{formatNumber(hours)} h</span>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={`More hours for ${item.name}`}
            disabled={busy || hours >= item.maxHoursPerDay}
            onClick={() => onHoursChange(item.id, roundHours(Math.min(item.maxHoursPerDay, hours + 0.5)))}
          >
            <Plus />
          </Button>
          {item.isReduced && (
            <span className="text-xs text-warning">was {formatNumber(item.originalHours)}h</span>
          )}
        </div>
      </td>
      <td className="px-2 py-3">{formatNumber(item.dailyKwh)}</td>
      <td className="px-2 py-3">{formatPeso(item.monthlyCost)}</td>
    </tr>
  );
}
