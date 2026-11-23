import { Plus, Share2, Trash2 } from "lucide-react";
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
  const { openSetup, openShare, openJoin, openDelete } = useHouseholds();
  const selected = households.find((household) => String(household.id) === value);

  // With no household yet, the page shows its own "Set up household" prompt instead.
  if (households.length === 0) {
    return null;
  }

  // On desktop the Sidebar already shows the active household card with all actions.
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm md:hidden">
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
      <Button variant="outline" onClick={openSetup} disabled={disabled}>
        <Plus />
        Add household
      </Button>
      {openShare && selected?.is_owner && (
        <Button variant="outline" onClick={() => openShare(selected)} disabled={disabled}>
          <Share2 />
          Share household
        </Button>
      )}
      {openJoin && (
        <Button variant="outline" onClick={openJoin} disabled={disabled}>Join with PIN</Button>
      )}
      {selected?.is_owner && (
        <Button variant="destructive" onClick={() => openDelete(selected)} disabled={disabled}>
          <Trash2 />
          Delete household
        </Button>
      )}
    </div>
  );
}
