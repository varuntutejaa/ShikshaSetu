"use client";

import { cn } from "@/lib/utils";

const BAR_COUNT = 32;

export function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-12">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-[3px] rounded-full bg-primary/70",
            active ? "animate-waveform" : "h-1.5 bg-muted-foreground/30"
          )}
          style={
            active
              ? {
                  animationDelay: `${(i % 12) * 0.09}s`,
                  animationDuration: `${0.9 + (i % 5) * 0.15}s`,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}
