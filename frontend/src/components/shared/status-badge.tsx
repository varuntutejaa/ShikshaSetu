import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RiskLevel, StudentStatus } from "@/lib/types";

const STATUS_STYLES: Record<StudentStatus, string> = {
  "On Track": "bg-success/15 text-success border-success/20",
  "Needs Support": "bg-warning/25 text-warning-foreground border-warning/30",
  "At Risk": "bg-destructive/10 text-destructive border-destructive/20",
};

const RISK_STYLES: Record<RiskLevel, string> = {
  Low: "bg-success/15 text-success border-success/20",
  Medium: "bg-warning/25 text-warning-foreground border-warning/30",
  High: "bg-destructive/10 text-destructive border-destructive/20",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_STYLES[status])}>
      {status}
    </Badge>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return (
    <Badge variant="outline" className={cn("font-medium", RISK_STYLES[risk])}>
      {risk} Risk
    </Badge>
  );
}
