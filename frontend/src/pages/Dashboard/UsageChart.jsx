import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PERIODS, chartLabel } from "@/lib/dashboard";
import { formatKwh } from "@/lib/energy";
import { cn } from "@/lib/utils";

export default function UsageChart({ chart, period, onPeriodChange, busy }) {
  const periodInfo = CHART_PERIODS.find((option) => option.value === period);
  const { points } = chart;
  // The first bucket is always a full day, week, or month; the latest one may be partial.
  const fullLimit = points[0].limitKwh;
  const hasData = points.some((point) => point.kwh !== null);
  // Leave a little headroom above the tallest bar or limit line.
  const maxKwh = Math.max(...points.map((point) => Math.max(point.kwh ?? 0, point.limitKwh))) * 1.15;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg">Your usage</CardTitle>
          <CardDescription>
            {periodInfo.range} · dashed line = your {formatKwh(fullLimit)} {periodInfo.limit}
          </CardDescription>
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {CHART_PERIODS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={period === option.value ? "default" : "ghost"}
              className={cn(period !== option.value && "text-muted-foreground")}
              disabled={busy}
              onClick={() => onPeriodChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="relative">
          <div className="flex h-52 items-end gap-1.5 sm:gap-2">
            {points.map((point, index) => (
              <Bar
                key={point.startDate}
                point={point}
                maxKwh={maxKwh}
                isLatest={index === points.length - 1}
              />
            ))}
          </div>
          {!hasData && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              No meter readings yet. Log one to see your usage here.
            </p>
          )}
        </div>

        <div className="flex gap-1.5 sm:gap-2">
          {points.map((point) => (
            <span key={point.startDate} className="flex-1 text-center text-xs text-muted-foreground">
              {chartLabel(point.startDate, period)}
            </span>
          ))}
        </div>

        <div className="flex gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-green" /> Within limit
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" /> Over limit
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function barColor(point, isLatest) {
  if (point.overLimit) return "bg-warning";
  if (isLatest) return "bg-green";
  return "border border-green bg-green-soft";
}

function Bar({ point, maxKwh, isLatest }) {
  const toPercent = (kwh) => `${(kwh / maxKwh) * 100}%`;

  return (
    <div className="relative h-full flex-1">
      {point.kwh !== null && (
        <div
          title={`${formatKwh(point.kwh)} of ${formatKwh(point.limitKwh)}`}
          className={cn("absolute inset-x-0 bottom-0 rounded-t-md", barColor(point, isLatest))}
          style={{ height: toPercent(point.kwh) }}
        />
      )}
      {/* Each bar draws its own piece of the limit line, since the last week or month can be shorter. */}
      <div
        className="absolute -inset-x-1 border-t-2 border-dashed border-green/70"
        style={{ bottom: toPercent(point.limitKwh) }}
      />
    </div>
  );
}
