import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUDGET_STATUS } from "@/lib/dashboard";
import { formatPeso } from "@/lib/energy";

const RING_COLORS = {
  on_track: "stroke-green",
  projected_over_budget: "stroke-warning",
  over_budget: "stroke-danger",
  no_data: "stroke-green",
};

export default function BudgetSummary({ budget, status }) {
  const statusInfo = BUDGET_STATUS[status.status];
  const spent = status.spent ?? 0;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="font-heading text-lg">Monthly budget</CardTitle>
        <Badge variant={statusInfo.badge}>{statusInfo.label}</Badge>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <BudgetRing
          progress={budget > 0 ? spent / budget : 0}
          color={RING_COLORS[status.status]}
          spent={spent}
          budget={budget}
        />

        <dl className="flex flex-col gap-3 text-sm">
          <Row label="Days left" value={`${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"}`} />
          <Row
            label="Safe to spend / day"
            value={status.safePerDay === null ? "—" : formatPeso(status.safePerDay)}
          />
          <Row
            label="Projected end of month"
            value={status.projectedBill === null ? "—" : formatPeso(status.projectedBill)}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

function BudgetRing({ progress, color, spent, budget }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(progress, 1) * circumference;

  return (
    <div className="relative mx-auto size-48">
      <svg viewBox="0 0 200 200" className="size-full -rotate-90">
        <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="16" className="stroke-secondary" />
        {filled > 0 && <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          strokeWidth="16"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          className={color}
        />}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-heading text-3xl font-bold">{formatPeso(spent)}</p>
        <p className="text-xs text-muted-foreground">spent of {formatPeso(budget)}</p>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
