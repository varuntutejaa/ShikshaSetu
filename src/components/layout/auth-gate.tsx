"use client";

/** Real login gate for every (app) route: no session on this device -> sent
 * to /login instead of silently working anyway. See src/lib/teacher-auth.tsx.
 * useTeacherAuth's `teacher` is hydration-safe (useSyncExternalStore under
 * the hood), so it already reflects the real stored session by the time
 * this effect runs — no separate "loading" state needed. */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTeacherAuth } from "@/lib/teacher-auth";
import { Logo } from "@/components/brand/logo";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { teacher } = useTeacherAuth();
  const router = useRouter();

  useEffect(() => {
    if (!teacher) router.replace("/login");
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
