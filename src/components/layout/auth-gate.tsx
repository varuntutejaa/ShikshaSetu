"use client";

/** Real login gate for every (app) route: no session on this device -> sent
 * to /login instead of silently working anyway. See src/lib/teacher-auth.tsx. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTeacherAuth, hasStoredTeacherSession } from "@/lib/teacher-auth";
import { Logo } from "@/components/brand/logo";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { teacher } = useTeacherAuth();
  const router = useRouter();

  useEffect(() => {
    if (teacher) return;
    // Guard against the one-render transient "no session" that
    // useStoredTeacherSession's hydration-safe design produces on every
    // hard page load, even when a real session exists — see
    // hasStoredTeacherSession's docstring. Without this, a direct
    // navigation/refresh of any (app) page would bounce to /login and
    // then straight back to /dashboard before ever reaching the page you
    // actually asked for.
    if (hasStoredTeacherSession()) return;
    router.replace("/login");
  }, [teacher, router]);

  if (!teacher) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background">
        <Logo size={48} />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
