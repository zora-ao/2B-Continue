import { Sun, TrendingUp, Wallet, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BUDGET_STATUS } from "@/lib/dashboard";
import { formatKwh, formatNumber, formatPeso } from "@/lib/energy";

export default function StatCards({ dashboard }) {
  const { usage, status, solar, budget } = dashboard;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        icon={Zap}
        iconColor="text-green"
        label="Today's usage"
        value={usage.todayKwh === null ? "—" : formatKwh(usage.todayKwh)}
        note={
          usage.todayKwh === null
            ? "Not logged yet today"
            : `of ${formatKwh(usage.dailyLimitKwh)} daily limit`
        }
      />
      <StatCard
        icon={TrendingUp}
        iconColor="text-green"
        label="This month"
        value={usage.monthKwh === null ? "—" : formatKwh(usage.monthKwh)}
        note={
          usage.monthKwh === null
            ? "No readings this month"
            : `${formatNumber(usage.allowanceUsedPercent)}% of ${formatKwh(usage.allowanceKwh)} allowance`
        }
      />
      <StatCard
        icon={Wallet}
        iconColor="text-green"
        label="Projected bill"
        value={status.projectedBill === null ? "—" : formatPeso(status.projectedBill)}
        note={`Budget ${formatPeso(budget)} · ${BUDGET_STATUS[status.status].label.toLowerCase()}`}
      />
      <StatCard
        icon={Sun}
        iconColor="text-yellow"
        label="Solar today"
        value={solar.todayKwh === null ? "—" : formatKwh(solar.todayKwh)}
        note={solarNote(solar)}
      />
    </div>
  );
}

function solarNote(solar) {
  if (solar.todayKwh === null) return "No solar log today";
  if (solar.savings === null) return "Log self-use to see savings";
  return `Saved about ${formatPeso(solar.savings)}`;
}

function StatCard({ icon: Icon, iconColor, label, value, note }) {
  return (
    <Card className="gap-2 p-6">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icon className={`size-4 ${iconColor}`} />
        {label}
      </p>
      <p className="font-heading text-3xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{note}</p>
    </Card>
  );
}
