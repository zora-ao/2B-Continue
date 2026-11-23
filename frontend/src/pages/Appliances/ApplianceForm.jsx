import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
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
import { dailyKwh, formatKwh, formatPeso, monthlyCost } from "@/lib/energy";
import {
  APPLIANCE_TYPES,
  EMPTY_FORM,
  applianceToForm,
  parseApplianceForm,
} from "./applianceForm.js";

// Add or edit one appliance.
//   editing  – the appliance being edited, or null when adding a new one
//   onSubmit – called with the checked appliance data
//   onCancel – called when the user stops editing
export default function ApplianceForm({ editing, onSubmit, onCancel, busy, rate, days }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  // When the user clicks Edit on a card, load that appliance into the form.
  useEffect(() => {
    setForm(editing ? applianceToForm(editing) : EMPTY_FORM);
    setErrors({});
  }, [editing]);

  // Updates one field, e.g. updateField("watts", "900").
  function updateField(field, value) {
    setForm({ ...form, [field]: value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    const result = parseApplianceForm(form);
    setErrors(result.errors);
    if (result.appliance) {
      if (await onSubmit(result.appliance)) setForm(EMPTY_FORM);
    }
  }

  // Live preview: only shown once the numbers are valid.
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
            {/* The camera scan comes later (Google Vision). */}
            <Button type="button" variant="secondary" size="lg" disabled>
              <Camera />
              Scan appliance (coming soon)
            </Button>

            <Field id="name" label="Name" error={errors.name}>
              <Input
                id="name"
                placeholder="e.g. Bedroom aircon"
                value={form.name}
                aria-invalid={Boolean(errors.name)}
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

// A label, the input, and the error message under it.
function Field({ id, label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
