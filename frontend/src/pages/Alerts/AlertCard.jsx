import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { alertStyle, timeAgo } from "@/lib/alerts";
import { cn } from "@/lib/utils";

export default function AlertCard({ alert, onMarkRead, busy }) {
  const { Icon, iconColor, unreadBorder, badge, categoryLabel } = alertStyle(alert);

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border bg-card p-5 sm:flex-row sm:items-center",
        alert.isRead ? "border-border" : unreadBorder,
      )}
    >
      <div className="flex min-w-0 flex-1 gap-4">
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
          <Icon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-medium">{alert.title}</h2>
            <Badge variant={badge}>{categoryLabel}</Badge>
            {!alert.isRead && <span className="sr-only">(unread)</span>}
          </div>
          <p className="text-sm text-muted-foreground">{alert.message}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
        <span className="text-xs text-muted-foreground">{timeAgo(alert.createdAt)}</span>
        <div className="flex gap-2">
          {!alert.isRead && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Mark "${alert.title}" as read`}
              title="Mark as read"
              disabled={busy}
              onClick={() => onMarkRead(alert.id)}
            >
              <Check />
            </Button>
          )}
          {alert.action && (
            <Button variant="outline" asChild>
              <Link to={alert.action.href} onClick={() => !alert.isRead && onMarkRead(alert.id)}>
                {alert.action.label}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
