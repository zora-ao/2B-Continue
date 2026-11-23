import { Link } from "react-router-dom";
import { CircleCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { alertStyle } from "@/lib/alerts";

export default function AlertsList({ alerts, alertCount }) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-heading text-lg">Alerts</CardTitle>
        {alertCount > 0 && (
          <Link to="/alerts" className="text-sm text-primary hover:underline">
            View all ({alertCount})
          </Link>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {alerts.length === 0 && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck className="size-4 text-green" />
            No alerts right now. Nice work!
          </p>
        )}

        {alerts.map((alert) => {
          const { Icon, iconColor } = alertStyle(alert);
          return (
            <div key={alert.id} className="flex gap-3">
              <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                <Icon className="size-4" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="font-medium">{alert.title}</p>
                <p className="text-sm text-muted-foreground">{alert.message}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
