import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Dropdown for choosing which household a page shows.
// Hidden when there is only one household.
export default function HouseholdPicker({ households, value, onChange, disabled }) {
  if (households.length < 2) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted-foreground">Household</span>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="min-w-48">
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
    </div>
  );
}
