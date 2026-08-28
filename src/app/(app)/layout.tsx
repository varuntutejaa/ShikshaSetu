import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { AuthGate } from "@/components/layout/auth-gate";
import { TeacherAuthProvider } from "@/lib/teacher-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TeacherAuthProvider>
      <AuthGate>
        <div className="flex h-screen w-full overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto bg-background">{children}</main>
            <MobileNav />
          </div>
        </div>
      </AuthGate>
    </TeacherAuthProvider>
  );
}
