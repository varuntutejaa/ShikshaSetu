"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RiskBadge } from "@/components/shared/status-badge";
import { listStudents, LANGUAGE_CODE_TO_NAME, type Student } from "@/lib/api";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function StudentsTable() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    listStudents()
      .then((s) => {
        if (!cancelled) setStudents(s);
      })
      .catch(() => {
        if (!cancelled) setStudents([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      const matchesQuery = s.name.toLowerCase().includes(query.toLowerCase());
      const matchesRisk = riskFilter === "all" || s.risk_level === riskFilter;
      return matchesQuery && matchesRisk;
    });
  }, [students, query, riskFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search students by name…"
            className="pl-9"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risk levels</SelectItem>
            <SelectItem value="Low">Low risk</SelectItem>
            <SelectItem value="Medium">Medium risk</SelectItem>
            <SelectItem value="High">High risk</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {students !== null && (
        <p className="text-sm text-muted-foreground">
          {students.length} student{students.length === 1 ? "" : "s"} total
        </p>
      )}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Mother Tongue</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Reading</TableHead>
                <TableHead>Numeracy</TableHead>
                <TableHead>Vocabulary</TableHead>
                <TableHead>Overall</TableHead>
                <TableHead className="text-right">Risk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students === null && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                    Loading students…
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s) => (
                <TableRow key={s.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/students/${s.id}`} className="flex items-center gap-3 group">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                          {initials(s.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                          {s.name}
                        </p>
                        <p className="text-xs text-muted-foreground">Grade {s.grade}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80">
                    {LANGUAGE_CODE_TO_NAME[s.mother_tongue] ?? s.mother_tongue}
                  </TableCell>
                  <TableCell className="text-sm text-foreground/80 tabular-nums">{Math.round(s.attendance)}%</TableCell>
                  <TableCell className="text-sm text-foreground/80 tabular-nums">{Math.round(s.reading_score)}%</TableCell>
                  <TableCell className="text-sm text-foreground/80 tabular-nums">{Math.round(s.numeracy_score)}%</TableCell>
                  <TableCell className="text-sm text-foreground/80 tabular-nums">{Math.round(s.vocabulary_score)}%</TableCell>
                  <TableCell className="text-sm font-semibold text-foreground tabular-nums">{Math.round(s.overall_score)}%</TableCell>
                  <TableCell className="text-right">
                    <RiskBadge risk={s.risk_level} />
                  </TableCell>
                </TableRow>
              ))}
              {students !== null && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">
                    {students.length === 0
                      ? "No students yet — they'll appear here once registered from the Android app."
                      : "No students match your search."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
