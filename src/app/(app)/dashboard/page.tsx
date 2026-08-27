import { GraduationCap, BookOpenCheck, ClipboardList, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { TodayClassCard } from "@/components/dashboard/today-class-card";
import { PerformanceTable } from "@/components/dashboard/performance-table";
import { LearningGapsCard } from "@/components/dashboard/learning-gaps-card";
import { STATS } from "@/lib/mock-data";

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          Good Morning, Teacher 👋
        </h1>
        <p className="mt-1 text-muted-foreground">
          Let&apos;s make today&apos;s classroom multilingual.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Students"
          value={STATS.totalStudents}
          icon={GraduationCap}
          accent="primary"
        />
        <StatCard
          label="Lessons Completed"
          value={STATS.lessonsCompleted}
          icon={BookOpenCheck}
          accent="info"
        />
        <StatCard
          label="Assessments"
          value={STATS.assessments}
          icon={ClipboardList}
          accent="success"
        />
        <StatCard
          label="Class Average"
          value={STATS.classAverage}
          suffix="%"
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
