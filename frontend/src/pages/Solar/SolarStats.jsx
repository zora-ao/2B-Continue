import { CircleCheck, Sun, TriangleAlert, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatKwh, formatNumber, formatPeso } from "@/lib/energy";

export default function SolarStats({ mySystem }) {
  const { today, savedThisMonth, alerts } = mySystem;

  return (
    <div className="flex flex-col gap-4">
      <StatCard
        icon={Sun}
        iconColor="text-yellow"
        label="Generated today"
        value={today.generatedKwh === null ? "—" : formatKwh(today.generatedKwh)}
        note={todayNote(today)}
      />
      <StatCard
        icon={Wallet}
        iconColor="text-green"
        label="Saved this month"
        value={savedThisMonth.amount === null ? "—" : formatPeso(savedThisMonth.amount)}
        note={savedNote(savedThisMonth)}
      />

      {alerts.length === 0 ? (
        <Card className="flex-row items-center gap-3 p-5 text-sm text-muted-foreground">
          <CircleCheck className="size-4 shrink-0 text-green" />
          Your panels are performing as expected this week.
        </Card>
      ) : (
        alerts.map((alert) => (
          <div key={alert.id} role="alert" className="flex flex-col gap-1.5 rounded-xl border border-danger/60 bg-danger-soft p-5">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <TriangleAlert className="size-4 shrink-0 text-danger" />
              {alert.title}
            </p>
            <p className="text-sm text-muted-foreground">{alert.message}</p>
          </div>
        ))
      )}
    </div>
  );
}

function todayNote(today) {
  if (today.generatedKwh === null) {
    return today.expectedKwh === null ? "Not logged yet today" : `Not logged yet · expected ${formatKwh(today.expectedKwh)}`;
  }
  if (today.percentOfExpected === null) return "Expected output unavailable";
  return `${Math.round(today.percentOfExpected)}% of expected ${formatKwh(today.expectedKwh)}`;
}

function savedNote(saved) {
  if (saved.amount === null) return "No solar readings this month";
  if (saved.billReducedPercent === null) return "Log meter readings to see your bill reduction";
  return `Bill reduced by ${Math.round(saved.billReducedPercent)}%`;
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
