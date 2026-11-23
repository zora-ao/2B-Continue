import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_STYLES, energyAllowance, parseBudget } from "@/lib/budget";
import { formatKwh, formatPeso } from "@/lib/energy";
import { cn } from "@/lib/utils";

export default function BudgetForm({
  budget,
  onBudgetChange,
  rate,
  days,
  style,
  onStyleChange,
  onGenerate,
  busy,
}) {
  const budgetNumber = parseBudget(budget);
  const isValidBudget = budgetNumber !== null;
  const allowance = isValidBudget ? energyAllowance(budgetNumber, rate, days) : null;
  const styleHint = PLAN_STYLES.find((option) => option.value === style)?.hint;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">1. Your budget</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="budget">Monthly budget (₱)</Label>
          <Input
            id="budget"
            type="number"
            min="0"
            step="100"
            placeholder="2000"
            className="h-12 text-xl font-semibold"
            value={budget}
            aria-invalid={!isValidBudget}
            aria-describedby={isValidBudget ? undefined : "budget-error"}
            onChange={(event) => onBudgetChange(event.target.value)}
          />
          {!isValidBudget && (
            <p id="budget-error" className="text-sm text-danger">Enter a budget of ₱0 or more (up to 2 decimals)</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Electricity rate</Label>
          <p className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm">
            ₱{rate.toFixed(2)} / kWh
          </p>
          <p className="text-xs text-muted-foreground">From your household settings</p>
        </div>

        {allowance && (
          <div className="rounded-xl bg-green-soft p-4">
            <p className="text-xs font-semibold tracking-wide text-green uppercase">
              Your energy allowance
            </p>
            <p className="font-heading text-3xl font-bold">
              {formatKwh(allowance.monthlyKwh)} / month
            </p>
            <p className="text-sm text-muted-foreground">
              ≈ {formatKwh(allowance.dailyKwh)} per day · {formatPeso(allowance.dailyCost)} per day
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="font-heading text-lg">2. Plan style</h3>
          <div role="group" aria-label="Plan style" className="grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {PLAN_STYLES.map((option) => (
              <Button
                key={option.value}
                type="button"
                aria-pressed={style === option.value}
                variant={style === option.value ? "default" : "ghost"}
                className={cn(style !== option.value && "text-muted-foreground")}
                onClick={() => onStyleChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {styleHint} Must-have appliances (lock icon) always keep their hours.
          </p>
        </div>

        <Button size="lg" disabled={!isValidBudget || busy} onClick={onGenerate}>
          <Zap />
          Generate plan
        </Button>
      </CardContent>
    </Card>
  );
}
