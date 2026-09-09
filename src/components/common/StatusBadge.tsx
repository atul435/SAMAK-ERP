import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  submitted: "bg-info/10 text-info border-info/30",
  pending_approval: "bg-warning/15 text-warning-foreground border-warning/40",
  approved: "bg-success/15 text-success border-success/30",
  executed: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  in_progress: "bg-primary/10 text-primary border-primary/25",
  blocked: "bg-destructive/10 text-destructive border-destructive/30",
  completed: "bg-success/15 text-success border-success/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  archived: "bg-muted text-muted-foreground border-border",
  green: "bg-success/15 text-success border-success/30",
  amber: "bg-warning/15 text-warning-foreground border-warning/40",
  red: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/40",
  info: "bg-info/10 text-info border-info/30",
};

export function StatusBadge({ value, className }: { value: string | null; className?: string }) {
  const key = (value ?? "draft").toLowerCase();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE[key] ?? "bg-secondary text-secondary-foreground border-border",
        className,
      )}
    >
      {titleCase(key)}
    </span>
  );
}
