import { useState } from "react";
import { Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKwh, totalDailyKwh } from "@/lib/energy";
import ApplianceCard from "./ApplianceCard.jsx";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "mustHave", label: "Must-have" },
  { value: "flexible", label: "Flexible" },
];

// Keeps only the appliances that match the chosen filter.
function applyFilter(appliances, filter) {
  if (filter === "mustHave") {
    return appliances.filter((appliance) => appliance.isMustHave);
  }
  if (filter === "flexible") {
    return appliances.filter((appliance) => !appliance.isMustHave);
  }
  return appliances;
}

export default function ApplianceList({ appliances, onEdit, onDelete }) {
  const [filter, setFilter] = useState("all");
  const shown = applyFilter(appliances, filter);

  return (
    <section className="flex flex-col gap-4">
      {/* Filter chips + daily total */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((option) => {
            const count = applyFilter(appliances, option.value).length;
            return (
              <Button
                key={option.value}
                variant={filter === option.value ? "default" : "secondary"}
                className="rounded-full"
                onClick={() => setFilter(option.value)}
              >
                {option.label} ({count})
              </Button>
            );
          })}
        </div>

        <p className="text-sm text-muted-foreground">
          Total ≈{" "}
          <span className="font-heading font-semibold text-foreground">
            {formatKwh(totalDailyKwh(appliances))}
          </span>{" "}
          / day
        </p>
      </div>

      {/* Cards, or an empty message */}
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">
          <Plug className="size-8" />
          <p>
            {filter === "all"
              ? "No appliances yet. Add your first one using the form."
              : "Nothing here for this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
          {shown.map((appliance) => (
            <ApplianceCard
              key={appliance.id}
              appliance={appliance}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
