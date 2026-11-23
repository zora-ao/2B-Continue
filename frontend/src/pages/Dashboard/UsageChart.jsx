import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_PERIODS, chartLabel } from "@/lib/dashboard";
import { formatKwh, formatNumber } from "@/lib/energy";
import { cn } from "@/lib/utils";

export default function UsageChart({ chart, period, onPeriodChange, busy }) {
  const [activeKey, setActiveKey] = useState(null);
  const periodInfo = CHART_PERIODS.find((option) => option.value === period);
  const { points } = chart;
  // The first bucket is always a full day, week, or month; the latest one may be partial.
  const fullLimit = points[0].limitKwh;
  const hasData = points.some((point) => point.kwh !== null);
  // Leave a little headroom above the tallest bar or limit line.
  const maxKwh = Math.max(1, ...points.map((point) => Math.max(point.kwh ?? 0, point.limitKwh))) * 1.15;
  const activePoint = points.find((point) => point.startDate === activeKey) ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="font-heading text-lg">Your usage</CardTitle>
          <CardDescription>
            {periodInfo.range} · dashed line = your {formatKwh(fullLimit)} {periodInfo.limit}
          </CardDescription>
        </div>
        <div role="group" aria-label="Chart period" className="flex gap-1 rounded-lg bg-secondary p-1">
          {CHART_PERIODS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              aria-pressed={period === option.value}
              variant={period === option.value ? "default" : "ghost"}
              className={cn(period !== option.value && "text-muted-foreground")}
              disabled={busy}
              onClick={() => {
                setActiveKey(null);
                onPeriodChange(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {/* Screen readers get the numbers as a table; the bars below are visual only. */}
        {hasData && (
          <table className="sr-only">
            <caption>Your usage, {periodInfo.range}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Used</th>
                <th scope="col">Limit</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.startDate}>
                  <th scope="row">{chartLabel(point.startDate, period)}</th>
                  <td>{point.kwh === null ? "No reading" : formatKwh(point.kwh)}</td>
                  <td>{formatKwh(point.limitKwh)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="flex gap-2" aria-hidden={hasData || undefined}>
          {/* Subtle y-axis ticks (max, mid, 0) */}
          <div className="flex h-52 w-10 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground">
            <span>{formatNumber(maxKwh)}</span>
            <span>{formatNumber(maxKwh / 2)}</span>
            <span>0</span>
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Faint horizontal gridlines */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <div className="border-t border-border/40" />
              <div className="border-t border-border/40" />
              <div className="border-t border-border/60" />
            </div>

            <div
              className="relative flex h-52 items-end gap-1.5 sm:gap-2"
              onMouseLeave={() => setActiveKey(null)}
            >
              {points.map((point, index) => (
                <Bar
                  key={point.startDate}
                  point={point}
                  maxKwh={maxKwh}
                  isLatest={index === points.length - 1}
                  isActive={activeKey === point.startDate}
                  onSelect={() => setActiveKey((current) => (current === point.startDate ? null : point.startDate))}
                  onHover={() => setActiveKey(point.startDate)}
                />
              ))}
            </div>
            {!hasData && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                No meter readings yet. Log one to see your usage here.
              </p>
            )}
          </div>
        </div>

        <div aria-hidden="true" className="flex gap-1.5 pl-12 sm:gap-2">
          {points.map((point) => (
            <span
              key={point.startDate}
              className={cn(
                "flex-1 text-center text-xs transition-colors",
                activeKey === point.startDate ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {chartLabel(point.startDate, period)}
            </span>
          ))}
        </div>

        <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs text-muted-foreground">
          <div className="flex gap-5">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-green" /> Within limit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-warning" /> Over limit
            </span>
          </div>
          <p className="tabular-nums">
            {activePoint ? (
              <span className="font-medium text-foreground">
                {chartLabel(activePoint.startDate, period)} ·{" "}
                {activePoint.kwh === null ? "No reading" : formatKwh(activePoint.kwh)}{" "}
                <span className="font-normal text-muted-foreground">
                  (limit {formatKwh(activePoint.limitKwh)})
                </span>
              </span>
            ) : (
              hasData && "Hover or tap a bar to inspect"
            )}
          </p>
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

function Bar({ point, maxKwh, isLatest, isActive, onHover, onSelect }) {
  const toPercent = (kwh) => `${(kwh / maxKwh) * 100}%`;

  return (
    <div
      className={cn(
        "relative h-full flex-1 cursor-pointer rounded-t-md transition-colors",
        isActive && "bg-secondary/60",
      )}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      {point.kwh !== null && (
        <div
          title={`${formatKwh(point.kwh)} of ${formatKwh(point.limitKwh)}`}
          className={cn("absolute inset-x-0 bottom-0 rounded-t-md transition-opacity", barColor(point, isLatest))}
          style={{ height: toPercent(point.kwh) }}
        />
      )}
      {/* Each bar draws its own piece of the limit line, since the last week or month can be shorter. */}
      <div
        className="pointer-events-none absolute -inset-x-1 border-t-2 border-dashed border-green/70"
        style={{ bottom: toPercent(point.limitKwh) }}
      />
    </div>
  );
}
