import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEARNING_GAPS } from "@/lib/mock-data";

const SEVERITY_STYLES: Record<string, string> = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-warning/25 text-warning-foreground border-warning/30",
  Low: "bg-success/15 text-success border-success/20",
};

export function LearningGapsCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-warning-foreground" />
        <h3 className="font-semibold text-foreground">Learning Gaps</h3>
      </div>
      <div className="space-y-3">
        {LEARNING_GAPS.map((gap) => (
          <div
            key={gap.concept}
            className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{gap.concept}</p>
              <p className="text-xs text-muted-foreground">
                {gap.studentsAffected} students affected
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn("font-medium", SEVERITY_STYLES[gap.severity])}
            >
              {gap.severity}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
