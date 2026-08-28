"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listStudents, getStudentLearningInsights } from "@/lib/api";

const SEVERITY_STYLES: Record<string, string> = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Medium: "bg-warning/25 text-warning-foreground border-warning/30",
  Low: "bg-success/15 text-success border-success/20",
};

interface Gap {
  concept: string;
  studentsAffected: number;
  severity: "High" | "Medium" | "Low";
}

function severityFor(avgScore: number): Gap["severity"] {
  if (avgScore < 40) return "High";
  if (avgScore < 55) return "Medium";
  return "Low";
}

export function LearningGapsCard() {
  const [gaps, setGaps] = useState<Gap[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const students = await listStudents();
        // Real weak concepts, aggregated from each student's recorded
        // progress events — capped defensively for a large roster.
        const insights = await Promise.all(
          students.slice(0, 40).map((s) => getStudentLearningInsights(s.id).catch(() => null))
        );

        const byConcept = new Map<string, { count: number; scoreSum: number }>();
        for (const insight of insights) {
          if (!insight) continue;
          for (const w of insight.weak_concepts) {
            const entry = byConcept.get(w.concept) ?? { count: 0, scoreSum: 0 };
            entry.count += 1;
            entry.scoreSum += w.average_score;
            byConcept.set(w.concept, entry);
          }
        }

        const aggregated: Gap[] = Array.from(byConcept.entries())
          .map(([concept, { count, scoreSum }]) => ({
            concept,
            studentsAffected: count,
            severity: severityFor(scoreSum / count),
          }))
          .sort((a, b) => b.studentsAffected - a.studentsAffected)
          .slice(0, 5);

        if (!cancelled) setGaps(aggregated);
      } catch {
        if (!cancelled) setGaps([]);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-4 w-4 text-warning-foreground" />
        <h3 className="font-semibold text-foreground">Learning Gaps</h3>
      </div>

      {gaps === null && (
        <div className="flex items-center justify-center py-8 text-sm text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Analyzing assessments…
        </div>
      )}

      {gaps?.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">
          No learning gaps detected yet — assign a quiz or AI Viva to start collecting data.
        </p>
      )}

      <div className="space-y-3">
        {gaps?.map((gap) => (
          <div
            key={gap.concept}
            className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3.5 py-3"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{gap.concept}</p>
              <p className="text-xs text-muted-foreground">
                {gap.studentsAffected} student{gap.studentsAffected === 1 ? "" : "s"} affected
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
