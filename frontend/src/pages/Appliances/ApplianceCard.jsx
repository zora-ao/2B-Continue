import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/appliances";
import { formatKwh, formatPeso, monthlyCost, monthlyKwh } from "@/lib/energy";

export default function ApplianceCard({ appliance, onEdit, onDelete }) {
  const TypeIcon = getTypeIcon(appliance.type);

  // "900 W · 4 h/day", or "5 × 9 W · 5 h/day" when there is more than one.
  let usage = `${appliance.watts} W · ${appliance.hoursPerDay} h/day`;
  if (appliance.quantity > 1) {
    usage = `${appliance.quantity} × ${usage}`;
  }

  return (
    <Card className="gap-4 p-5">
      {/* Top row: icon, name and usage, action buttons */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <TypeIcon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold">{appliance.name}</h3>
            {appliance.isMustHave && <Badge variant="success">Must-have</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{usage}</p>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${appliance.name}`}
            onClick={() => onEdit(appliance)}
          >
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Delete ${appliance.name}`}
            className="hover:text-danger"
            onClick={() => onDelete(appliance)}
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Bottom row: monthly estimate */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Monthly estimate</span>
        <span className="font-heading font-semibold">
          {formatKwh(monthlyKwh(appliance))} · {formatPeso(monthlyCost(appliance))}
        </span>
      </div>
    </Card>
  );
}
