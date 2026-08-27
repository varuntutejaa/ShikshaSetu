import { AlertCircle, Lightbulb, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { VivaConfig } from "@/components/viva/viva-setup";
import { STUDENTS } from "@/lib/mock-data";
import type { VivaReport as VivaReportData } from "@/lib/api";

const SKILL_BREAKDOWN = [
  { label: "Reading Ability", value: 72 },
  { label: "Comprehension", value: 65 },
  { label: "Numeracy", value: 58 },
  { label: "Vocabulary", value: 70 },
];

export function VivaReport({
  config,
  correct,
  total,
  liveReport,
  onRestart,
}: {
  config: VivaConfig;
  correct: number;
  total: number;
  liveReport?: VivaReportData;
  onRestart: () => void;
}) {
  const incorrect = total - correct;
  const student = STUDENTS.find((s) => s.id === config.studentId);
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const skillBreakdown = liveReport
    ? SKILL_BREAKDOWN.map((skill) => ({ ...skill, value: scorePercent }))
    : SKILL_BREAKDOWN;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Viva completed for <span className="font-medium text-foreground">{student?.name}</span>
        </p>
        <h2 className="text-2xl font-semibold text-foreground mt-1">Viva Report</h2>
        {liveReport && (
          <Badge className="mt-2 bg-primary/10 text-primary gap-1 font-normal">
            <Sparkles className="h-3 w-3" /> Evaluated live by the ShikshaSetu backend
          </Badge>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-center gap-8 pb-6 mb-6 border-b border-border/70">
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">
              {correct}
              <span className="text-lg text-muted-foreground">/{total}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">Score</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-success">{correct}</p>
            <p className="text-xs text-muted-foreground mt-1">Correct</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold text-destructive">{incorrect}</p>
            <p className="text-xs text-muted-foreground mt-1">Incorrect</p>
          </div>
        </div>

        <div className="space-y-4">
          {skillBreakdown.map((skill) => (
            <div key={skill.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm text-foreground/90">{skill.label}</span>
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {skill.value}%
                </span>
              </div>
              <Progress value={skill.value} className="h-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/10 p-5 flex gap-3">
        <AlertCircle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-warning-foreground">AI Learning Gap</p>
          {liveReport ? (
            liveReport.weaknesses.length > 0 ? (
              <ul className="text-sm text-warning-foreground/90 mt-0.5 space-y-0.5">
                {liveReport.weaknesses.map((w) => (
                  <li key={w}>Student struggles with {w.toLowerCase()}.</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-warning-foreground/90 mt-0.5">
                No significant learning gaps detected in this session.
              </p>
            )
          ) : (
            <p className="text-sm text-warning-foreground/90 mt-0.5">
              Student struggles with addition above 10.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-info/30 bg-info/10 p-5 flex gap-3">
        <Lightbulb className="h-5 w-5 text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-info">Recommended Intervention</p>
          {liveReport ? (
            <ul className="text-sm text-info/90 mt-0.5 space-y-0.5">
              {liveReport.recommended_interventions.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-info/90 mt-0.5">
              Practice addition using physical objects and visual counting.
            </p>
          )}
        </div>
      </div>

      <Button onClick={onRestart} variant="outline" size="lg" className="w-full gap-2">
        <RotateCcw className="h-4 w-4" />
        Start Another Viva
      </Button>
    </div>
  );
}
