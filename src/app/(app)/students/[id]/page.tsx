import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lightbulb, Mic } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RiskBadge, StatusBadge } from "@/components/shared/status-badge";
import { STUDENTS, ASSESSMENT_HISTORY, STUDENT_BACKEND_IDS } from "@/lib/mock-data";
import { API_BASE_URL } from "@/lib/api";

export default async function StudentProfilePage({
  params,
}: PageProps<"/students/[id]">) {
  const { id } = await params;
  const student = STUDENTS.find((s) => s.id === id);
  if (!student) notFound();

  const history = ASSESSMENT_HISTORY.filter((a) => a.studentId === student.id);
  const backendId = STUDENT_BACKEND_IDS[student.id];
  let liveInsights: {
    weak_concepts: { concept: string; average_score: number }[];
    strengths: { concept: string; average_score: number }[];
    recommendation: string;
    intervention_activity: { activity: string } | null;
  } | null = null;
  if (backendId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/students/${backendId}/learning-insights`, {
        cache: "no-store",
      });
      if (response.ok) liveInsights = await response.json();
    } catch {
      liveInsights = null;
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <Link
        href="/students"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to students
      </Link>

      <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center gap-5">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
            {student.avatarInitials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold text-foreground">{student.name}</h1>
            <StatusBadge status={student.status} />
            <RiskBadge risk={student.risk} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {student.class} · Mother tongue: {student.motherTongue} · Attendance {student.attendance}%
          </p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/viva">
            <Mic className="h-4 w-4" />
            Start AI Viva
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-4">Learning Progress</h3>
            <div className="space-y-4">
              <ProgressRow label="Reading" value={student.reading} />
              <ProgressRow label="Numeracy" value={student.numeracy} />
              <ProgressRow label="Vocabulary" value={student.vocabulary} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Assessment History</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Subject &amp; Topic</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-sm text-muted-foreground">{a.date}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">{a.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground/90">
                        {a.subject} · {a.topic}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-foreground tabular-nums">
                        {a.score}/{a.total}
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                        No assessment history yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground mb-3">Weak Concepts</h3>
            {(liveInsights?.weak_concepts.length || student.weakConcepts.length) > 0 ? (
              <div className="flex flex-wrap gap-2">
                {(liveInsights?.weak_concepts.map((w) => `${w.concept} ${w.average_score}%`) ?? student.weakConcepts).map((c) => (
                  <Badge
                    key={c}
                    variant="outline"
                    className="border-destructive/20 bg-destructive/10 text-destructive font-medium"
                  >
                    {c}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No weak concepts identified.</p>
            )}
          </div>

          {liveInsights?.strengths && liveInsights.strengths.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground mb-3">Strengths</h3>
              <div className="flex flex-wrap gap-2">
                {liveInsights.strengths.map((s) => (
                  <Badge key={s.concept} variant="outline" className="border-success/20 bg-success/10 text-success font-medium">
                    {s.concept} {s.average_score}%
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-info/30 bg-info/10 p-5 flex gap-3">
            <Lightbulb className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-info">AI Recommendation</p>
              <p className="text-sm text-info/90 mt-0.5">{liveInsights?.recommendation ?? student.aiRecommendation}</p>
              {liveInsights?.intervention_activity && (
                <p className="text-xs text-info/80 mt-2">{liveInsights.intervention_activity.activity}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressRow({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-foreground/90">{label}</span>
        <span className="text-sm font-medium text-foreground tabular-nums">{value}%</span>
      </div>
      <Progress value={value} className="h-2.5" />
    </div>
  );
}
