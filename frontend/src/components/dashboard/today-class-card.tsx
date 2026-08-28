"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Languages, Radio, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listClassroomSessions, LANGUAGE_CODE_TO_NAME, type ClassSession } from "@/lib/api";

export function TodayClassCard() {
  const [activeSession, setActiveSession] = useState<ClassSession | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    listClassroomSessions(undefined, "active")
      .then((sessions) => {
        if (!cancelled) setActiveSession(sessions[0] ?? null);
      })
      .catch(() => {
        if (!cancelled) setActiveSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const teacherLang = activeSession
    ? LANGUAGE_CODE_TO_NAME[activeSession.teacher_language] ?? activeSession.teacher_language
    : null;
  const studentLang = activeSession
    ? LANGUAGE_CODE_TO_NAME[activeSession.student_language] ?? activeSession.student_language
    : null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary to-primary/85 text-primary-foreground p-6 sm:p-7">
      <div
        aria-hidden
        className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
      />
      <div
        aria-hidden
        className="absolute -right-4 bottom-0 h-32 w-32 rounded-full bg-white/5"
      />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-primary-foreground/70">
            {activeSession ? <Radio className="h-3.5 w-3.5 animate-pulse" /> : <Sparkles className="h-3.5 w-3.5" />}
            {activeSession ? "Live Now" : "No Class In Progress"}
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {activeSession
              ? "A live class is currently running"
              : "Start today's live, translated class"}
          </h2>
          <p className="text-sm text-primary-foreground/80 mt-1">
            {activeSession
              ? "Rejoin to keep translating between you and your students in real time."
              : "Create a class, share the code, and speak — your students hear it in their language."}
          </p>

          {activeSession && teacherLang && studentLang && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm">
              <Languages className="h-4 w-4" />
              <span className="font-medium">{teacherLang}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-70" />
              <span className="font-medium">{studentLang}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-sm h-12 px-6 text-base font-semibold"
          >
            <Link href="/live-class">{activeSession ? "Rejoin Live Class" : "Start Live Class"}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="h-12 px-6 text-base font-semibold border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
          >
            <Link href="/lessons">Prepare Lesson</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
