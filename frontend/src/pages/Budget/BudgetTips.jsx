import { AirVent, Plug, Sun } from "lucide-react";
import { Card } from "@/components/ui/card";

const TIPS = [
  {
    icon: AirVent,
    color: "bg-warning-soft text-warning",
    title: "Set aircon to 25°C",
    text: "Each degree warmer cuts aircon use by about 6%.",
  },
  {
    icon: Plug,
    color: "bg-green-soft text-green",
    title: "Unplug idle devices",
    text: "Standby power can add about ₱60 a month.",
  },
  {
    icon: Sun,
    color: "bg-yellow-soft text-yellow",
    title: "Run heavy loads at midday",
    text: "Use solar output for laundry and ironing.",
  },
];

// Simple saving tips under the plan.
export default function BudgetTips() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-lg">Ways to stay within budget</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TIPS.map((tip) => (
          <Card key={tip.title} className="gap-3 p-5">
            <div className={`flex size-9 items-center justify-center rounded-lg ${tip.color}`}>
              <tip.icon className="size-5" />
            </div>
            <h3 className="font-medium">{tip.title}</h3>
            <p className="text-sm text-muted-foreground">{tip.text}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
