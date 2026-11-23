import { AirVent, Lightbulb, Plug, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";

// The server picks which tips to show; this only adds an icon and color.
const TIP_STYLES = {
  idle_devices: { icon: Plug, color: "bg-green-soft text-green" },
  aircon: { icon: AirVent, color: "bg-warning-soft text-warning" },
  usage: { icon: Receipt, color: "bg-yellow-soft text-yellow" },
};
const DEFAULT_STYLE = { icon: Lightbulb, color: "bg-secondary text-foreground" };

export default function BudgetTips({ tips }) {
  if (tips.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg">Ways to stay within budget</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tips.map((tip) => {
          const { icon: TipIcon, color } = TIP_STYLES[tip.id] ?? DEFAULT_STYLE;
          return (
            <Card key={tip.id} className="gap-3 p-5">
              <div className={`flex size-9 items-center justify-center rounded-lg ${color}`}>
                <TipIcon className="size-5" />
              </div>
              <h3 className="font-medium">{tip.title}</h3>
              <p className="text-sm text-muted-foreground">{tip.description}</p>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
