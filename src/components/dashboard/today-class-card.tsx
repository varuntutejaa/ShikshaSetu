import Link from "next/link";
import { ArrowRight, Languages, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TODAY_CLASS } from "@/lib/mock-data";

export function TodayClassCard() {
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
            <Sparkles className="h-3.5 w-3.5" />
            Today&apos;s Class
          </p>
          <h2 className="mt-2 text-xl font-semibold">
            {TODAY_CLASS.subject} · {TODAY_CLASS.topic}
          </h2>
          <p className="text-sm text-primary-foreground/80 mt-1">
            {TODAY_CLASS.class} · {TODAY_CLASS.time}
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm">
            <Languages className="h-4 w-4" />
            <span className="font-medium">{TODAY_CLASS.teacherLanguage}</span>
            <ArrowRight className="h-3.5 w-3.5 opacity-70" />
            <span className="font-medium">{TODAY_CLASS.studentLanguage}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            asChild
            size="lg"
            className="bg-white text-primary hover:bg-white/90 shadow-sm h-12 px-6 text-base font-semibold"
          >
            <Link href="/live-class">Start Live Class</Link>
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
