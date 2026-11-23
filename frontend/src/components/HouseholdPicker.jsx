import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHouseholds } from "@/hooks/useHouseholds";

export default function HouseholdPicker({ households, value, onChange, disabled }) {
  const { openSetup } = useHouseholds();

  // With no household yet, the page shows its own "Set up household" prompt instead.
  if (households.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {households.length > 1 && (
        <>
          <span className="text-muted-foreground">Household</span>
          <Select value={value} onValueChange={onChange} disabled={disabled}>
            <SelectTrigger className="min-w-48" aria-label="Household">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {households.map((household) => (
                <SelectItem key={household.id} value={String(household.id)}>
                  {household.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      )}
      <Button variant="outline" size="sm" onClick={openSetup} disabled={disabled}>
        <Plus />
        Add household
      </Button>
    </div>
  );
}
