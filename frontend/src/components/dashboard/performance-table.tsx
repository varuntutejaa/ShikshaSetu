"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/shared/status-badge";
import { listStudents, LANGUAGE_CODE_TO_NAME, type Student } from "@/lib/api";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function statusFor(overall: number): "On Track" | "Needs Support" | "At Risk" {
  if (overall >= 75) return "On Track";
  if (overall >= 60) return "Needs Support";
  return "At Risk";
}

export function PerformanceTable() {
  const [students, setStudents] = useState<Student[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listStudents()
      .then((s) => {
        if (!cancelled) setStudents(s.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground">Recent Student Performance</h3>
          <p className="text-sm text-muted-foreground">Latest assessment results</p>
        </div>
        <Link
          href="/students"
          className="text-sm font-medium text-primary hover:underline"
        >
          View all students
        </Link>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Reading</TableHead>
              <TableHead>Numeracy</TableHead>
              <TableHead>Vocabulary</TableHead>
              <TableHead>Overall</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students === null && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  Loading students…
                </TableCell>
              </TableRow>
            )}
            {students?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-10">
                  No students yet — they&apos;ll appear here once registered from the Android app.
                </TableCell>
              </TableRow>
            )}
            {students?.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/students/${s.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                        {initials(s.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {LANGUAGE_CODE_TO_NAME[s.mother_tongue] ?? s.mother_tongue}
                      </p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.reading_score} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {Math.round(s.reading_score)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.numeracy_score} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {Math.round(s.numeracy_score)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.vocabulary_score} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {Math.round(s.vocabulary_score)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-foreground tabular-nums">
                  {Math.round(s.overall_score)}%
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={statusFor(s.overall_score)} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
