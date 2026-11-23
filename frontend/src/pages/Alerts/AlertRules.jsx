import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { alertRules } from "@/lib/alerts";

export default function AlertRules({ settings, onToggle, busy }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">Alert rules</CardTitle>
        <CardDescription>
          Choose when Kuryenta should warn you. Alerts are checked each time you log a reading.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col">
        {alertRules(settings.thresholds).map((rule) => (
          <div
            key={rule.name}
            className="flex items-center justify-between gap-4 border-b border-border py-3.5 last:border-0"
          >
            <div className="flex flex-col gap-0.5">
              <Label htmlFor={`rule-${rule.name}`}>{rule.label}</Label>
              <p id={`rule-${rule.name}-hint`} className="text-xs text-muted-foreground">
                {rule.hint}
              </p>
            </div>
            <Switch
              id={`rule-${rule.name}`}
              aria-describedby={`rule-${rule.name}-hint`}
              checked={settings.rules[rule.name]}
              disabled={busy}
              onCheckedChange={(checked) => onToggle(rule.name, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
