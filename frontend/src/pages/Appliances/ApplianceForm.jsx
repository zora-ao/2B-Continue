import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  APPLIANCE_TYPES,
  EMPTY_FORM,
  applianceToForm,
  parseApplianceForm,
} from "@/lib/appliances";
import { dailyKwh, formatKwh, formatPeso, monthlyCost } from "@/lib/energy";
import { scanToFields } from "@/lib/scan";
import ScanControls from "./ScanControls";

export default function ApplianceForm({ editing, onSubmit, onCancel, busy, rate, days }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // Bumped when the form resets, so the scan controls start fresh (no stale "Filled" message).
  const [scanKey, setScanKey] = useState(0);

  useEffect(() => {
    setForm(editing ? applianceToForm(editing) : EMPTY_FORM);
    setErrors({});
  }, [editing]);

  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  // A scan only suggests name, type and watts; the user still checks them and adds hours.
  function applyScan(result) {
    setForm((current) => ({ ...current, ...scanToFields(result) }));
    setErrors((current) => ({ ...current, name: undefined, watts: undefined }));
    document.getElementById("hoursPerDay")?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const result = parseApplianceForm(form);
    setErrors(result.errors);
    // Move focus to the first field that needs fixing.
    const firstInvalid = ["name", "watts", "hoursPerDay", "quantity"].find((field) => result.errors[field]);
    if (firstInvalid) document.getElementById(firstInvalid)?.focus();
    if (result.appliance) {
      if (await onSubmit(result.appliance)) {
        setForm(EMPTY_FORM);
        setScanKey((key) => key + 1);
      }
    }
  }

  const preview = parseApplianceForm(form).appliance;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-lg">
          {editing ? "Edit appliance" : "Add appliance"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
            {!editing && <ScanControls key={scanKey} onResult={applyScan} disabled={busy} />}

            <Field id="name" label="Name" error={errors.name}>
              <Input
                id="name"
                placeholder="e.g. Bedroom aircon"
                value={form.name}
                aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                onChange={(event) => updateField("name", event.target.value)}
              />
            </Field>

            <Field id="type" label="Type">
              <Select value={form.type} onValueChange={(value) => updateField("type", value)}>
                <SelectTrigger id="type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APPLIANCE_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field id="watts" label="Power (W)" error={errors.watts}>
                <Input
                  id="watts"
                  type="number"
                  min="0"
                  placeholder="900"
                  value={form.watts}
                  aria-invalid={Boolean(errors.watts)}
                  aria-describedby={errors.watts ? "watts-error" : undefined}
                  onChange={(event) => updateField("watts", event.target.value)}
                />
              </Field>

              <Field id="hoursPerDay" label="Hours per day" error={errors.hoursPerDay}>
                <Input
                  id="hoursPerDay"
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  placeholder="4"
                  value={form.hoursPerDay}
                  aria-invalid={Boolean(errors.hoursPerDay)}
                  aria-describedby={errors.hoursPerDay ? "hoursPerDay-error" : undefined}
                  onChange={(event) => updateField("hoursPerDay", event.target.value)}
                />
              </Field>
            </div>

            <Field id="quantity" label="Quantity" error={errors.quantity}>
              <Input
                id="quantity"
                type="number"
                min="1"
                step="1"
                value={form.quantity}
                aria-invalid={Boolean(errors.quantity)}
                  aria-describedby={errors.quantity ? "quantity-error" : undefined}
                onChange={(event) => updateField("quantity", event.target.value)}
              />
            </Field>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isMustHave"
                checked={form.isMustHave}
                onCheckedChange={(checked) => updateField("isMustHave", checked === true)}
              />
              <Label htmlFor="isMustHave">Must-have (never cut by the planner)</Label>
            </div>

            {preview && (
              <p className="rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
                ≈ {formatKwh(dailyKwh(preview))}/day · {formatPeso(monthlyCost(preview, rate, days))}/month
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" size="lg" className="flex-1">
                {busy ? "Saving..." : editing ? "Save changes" : "Save appliance"}
              </Button>
              {editing && (
                <Button type="button" variant="outline" size="lg" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ id, label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
