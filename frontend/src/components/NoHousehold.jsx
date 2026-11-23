import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";

// Shown on a page when there is no household to load yet.
export default function NoHousehold() {
  const { openSetup } = useHouseholds();

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">No household yet</h2>
      <p className="text-sm text-muted-foreground">
        Add your household and its electricity rate to get started.
      </p>
      <Button onClick={openSetup}>
        <Home />
        Set up household
      </Button>
    </div>
  );
}
