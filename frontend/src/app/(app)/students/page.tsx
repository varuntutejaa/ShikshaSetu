import { PageHeader } from "@/components/shared/page-header";
import { StudentsTable } from "@/components/students/students-table";

export default function StudentsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <PageHeader
        title="Students"
        subtitle="Track progress and identify who needs support"
      />
      <StudentsTable />
    </div>
  );
}
