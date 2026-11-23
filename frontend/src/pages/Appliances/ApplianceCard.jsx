import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/appliances";
import { formatKwh, formatPeso } from "@/lib/energy";

export default function ApplianceCard({ appliance, onEdit, onDelete, busy }) {
  const TypeIcon = getTypeIcon(appliance.type);

  let usage = `${appliance.watts} W · ${appliance.hoursPerDay} h/day`;
  if (appliance.quantity > 1) {
    usage = `${appliance.quantity} × ${usage}`;
  }

  return (
    <Card className="gap-4 p-5">
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
            disabled={busy}
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${appliance.name}`}
            onClick={() => onEdit(appliance)}
          >
            <Pencil />
          </Button>
          <Button
            disabled={busy}
            variant="destructive"
            size="sm"
            aria-label={`Delete ${appliance.name}`}
            onClick={() => onDelete(appliance)}
          >
            <Trash2 />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Monthly estimate</span>
        <span className="font-heading font-semibold">
          {formatKwh(appliance.estimatedMonthlyKwh)} · {formatPeso(appliance.estimatedMonthlyCost)}
        </span>
      </div>
    </Card>
  );
}
