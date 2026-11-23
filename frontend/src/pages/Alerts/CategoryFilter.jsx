import { ALERT_CATEGORIES } from "@/lib/alerts";

export default function CategoryFilter({ category, counts, onChange }) {
  return (
    <div role="group" aria-label="Filter alerts by category" className="flex flex-wrap gap-2">
      {ALERT_CATEGORIES.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={category === option.value}
          onClick={() => onChange(option.value)}
          className="rounded-full border border-border px-3.5 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-green aria-pressed:bg-green-soft aria-pressed:text-green"
        >
          {option.label} ({counts[option.value] ?? 0})
        </button>
      ))}
    </div>
  );
}
