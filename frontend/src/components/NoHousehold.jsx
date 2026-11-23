import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHouseholds } from "@/hooks/useHouseholds";

// Shown on a page when there is no household to load yet.
export default function NoHousehold() {
  const { openSetup, openJoin } = useHouseholds();

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border p-6">
      <h2 className="text-lg font-semibold">No household yet</h2>
      <p className="text-sm text-muted-foreground">
        Add your household and its electricity rate to get started.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={openSetup}>
          <Home />
          Set up household
        </Button>
        {openJoin && <Button variant="outline" onClick={openJoin}>Join with PIN</Button>}
      </div>
    </div>
  );
}
