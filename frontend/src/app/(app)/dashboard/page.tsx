"use client";

import { useEffect, useState } from "react";
import { GraduationCap, BookOpenCheck, ClipboardList, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TodayClassCard } from "@/components/dashboard/today-class-card";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { LearningGapsCard } from "@/components/dashboard/learning-gaps-card";
import { listStudents, getStudentAssessments, getClassroomMetrics, ApiError } from "@/lib/api";
import { useTeacherAuth } from "@/lib/teacher-auth";

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

interface DashboardStats {
  totalStudents: number;
  lessonsCompleted: number;
  assessments: number;
  classAverage: number;
}

export default function DashboardPage() {
  const { teacher } = useTeacherAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [greeting, setGreeting] = useState<string>("Good Morning");

  useEffect(() => {
    setGreeting(getTimeOfDayGreeting());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [students, metrics] = await Promise.all([listStudents(), getClassroomMetrics()]);

        // Small classroom-sized fan-out — real per-student assessment
        // counts, not a fabricated total. Capped defensively in case the
        // roster ever grows large.
        const assessmentLists = await Promise.all(
          students.slice(0, 40).map((s) => getStudentAssessments(s.id).catch(() => []))
        );
        const assessments = assessmentLists.reduce((sum, list) => sum + list.length, 0);

        const scored = students.filter((s) => s.overall_score > 0);
        const classAverage = scored.length
          ? Math.round(scored.reduce((sum, s) => sum + s.overall_score, 0) / scored.length)
          : 0;

        if (!cancelled) {
          setStats({
            totalStudents: students.length,
            lessonsCompleted: Number(metrics.lessons_completed ?? 0),
            assessments,
            classAverage,
          });
        }
      } catch (err) {
        if (err instanceof ApiError) {
          console.warn(`Dashboard stats unavailable (${err.code}): ${err.message}`);
        }
        if (!cancelled) setStats({ totalStudents: 0, lessonsCompleted: 0, assessments: 0, classAverage: 0 });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {greeting}
          {teacher?.name ? `, ${teacher.name.split(" ")[0]}` : ""} 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Let&apos;s make today&apos;s classroom multilingual.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={stats ? stats.totalStudents : "—"}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard
          label="Lessons Completed"
          value={stats ? stats.lessonsCompleted : "—"}
          icon={BookOpenCheck}
          accent="info"
        />
        <StatCard
          label="Assessments"
          value={stats ? stats.assessments : "—"}
          icon={ClipboardList}
          accent="success"
        />
        <StatCard
          label="Class Average"
          value={stats ? stats.classAverage : "—"}
          suffix={stats ? "%" : undefined}
          icon={TrendingUp}
          accent="warning"
        />
      </div>

      <TodayClassCard />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PerformanceTable />
        </div>
        <LearningGapsCard />
      </div>
    </div>
  );
}
