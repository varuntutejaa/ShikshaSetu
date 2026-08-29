import { TopNav } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AuthGate } from "@/components/layout/auth-gate";
import { TeacherAuthProvider } from "@/lib/teacher-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeacherAuthProvider>
      <AuthGate>
        <div className="flex h-screen w-full flex-col overflow-hidden">
          <TopNav />
          <main className="flex-1 min-h-0 overflow-y-auto bg-background">{children}</main>
          <MobileNav />
        </div>
      </AuthGate>
    </TeacherAuthProvider>
  );
}
