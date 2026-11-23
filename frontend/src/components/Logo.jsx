import { Zap } from "lucide-react";

export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Zap className="size-[18px]" />
      </div>
      <span className={compact ? "sr-only" : "font-heading text-xl font-medium"}>Kuryenta</span>
    </div>
  );
}
