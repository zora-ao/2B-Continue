import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTypeIcon } from "@/lib/appliances";
import { formatNumber } from "@/lib/energy";
import { cn } from "@/lib/utils";

const MAX_ROWS = 5;

export default function PowerBreakdown({ items }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-heading text-lg">Where your power goes</CardTitle>
        <span className="text-xs text-muted-foreground">This month (estimated)</span>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Add appliances on the{" "}
            <Link to="/appliances" className="text-primary underline">
              Appliances page
            </Link>{" "}
            to see which ones use the most power.
          </p>
        )}

        {items.slice(0, MAX_ROWS).map((item, index) => (
          <BreakdownRow key={item.id} item={item} isBiggest={index === 0} />
        ))}
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ item, isBiggest }) {
  const TypeIcon = getTypeIcon(item.type);

  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
        <TypeIcon className="size-4" />
      </div>
      <div className="w-36 min-w-0 shrink-0">
        <p className="truncate font-medium">
          {item.name}
          {item.quantity > 1 && ` (×${item.quantity})`}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatNumber(item.watts)} W · {formatNumber(item.hoursPerDay)} h/day
        </p>
      </div>
      <div className="h-2 flex-1 rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full", isBiggest ? "bg-warning" : "bg-green")}
          style={{ width: `${item.percent}%` }}
        />
      </div>
      <span className="w-12 text-right text-sm font-medium">{formatNumber(item.percent)}%</span>
    </div>
  );
}
