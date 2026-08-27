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
import { STUDENTS } from "@/lib/mock-data";

export function PerformanceTable() {
  const rows = STUDENTS.slice(0, 6);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-semibold text-foreground">Recent Student Performance</h3>
          <p className="text-sm text-muted-foreground">Class 2 · Latest assessment results</p>
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
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/students/${s.id}`}
                    className="flex items-center gap-3 group"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-semibold">
                        {s.avatarInitials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                        {s.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{s.motherTongue}</p>
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.reading} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {s.reading}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.numeracy} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {s.numeracy}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="w-32">
                  <div className="flex items-center gap-2">
                    <Progress value={s.vocabulary} className="h-1.5" />
                    <span className="text-xs text-muted-foreground w-7 tabular-nums">
                      {s.vocabulary}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-foreground tabular-nums">
                  {s.overall}%
                </TableCell>
                <TableCell className="text-right">
                  <StatusBadge status={s.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
