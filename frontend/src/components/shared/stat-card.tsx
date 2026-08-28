import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "primary" | "success" | "info" | "warning";
  suffix?: string;
}

const ACCENT_STYLES: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  info: "bg-info/15 text-info",
  warning: "bg-warning/20 text-warning-foreground",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "primary",
  suffix,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start justify-between">
      <div>
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
          {value}
          {suffix && (
            <span className="text-base font-medium text-muted-foreground">
              {suffix}
            </span>
          )}
        </p>
      </div>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
          ACCENT_STYLES[accent]
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}
