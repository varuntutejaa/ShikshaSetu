"use client";

/**
 * A real audio-level visualizer, not a decorative animation: each bar's
 * height is driven by actual frequency-band energy read from the live
 * MediaStream via a Web Audio AnalyserNode, updated every animation frame.
 * Bar heights are written directly to the DOM via refs (not React state) —
 * this runs at up to 60fps and pushing that through React state on every
 * frame would be needless re-render churn for a purely visual effect.
 */

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const BAR_COUNT = 28;
const MIN_HEIGHT_PX = 4;
const MAX_HEIGHT_PX = 40;
const FFT_SIZE = 128; // -> 64 frequency bins, plenty for 28 bars

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
}

export function Waveform({ stream, active }: { stream: MediaStream | null; active: boolean }) {
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!active || !stream) {
      barRefs.current.forEach((el) => {
        if (el) el.style.height = `${MIN_HEIGHT_PX}px`;
      });
      return;
    }

    let rafId: number;
    let cancelled = false;
    const audioContext = new (getAudioContextCtor())();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.65;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const data = new Uint8Array(analyser.frequencyBinCount);
    const binsPerBar = Math.max(1, Math.floor(data.length / BAR_COUNT));

    function tick() {
      if (cancelled) return;
      analyser.getByteFrequencyData(data);
      for (let i = 0; i < BAR_COUNT; i++) {
        let sum = 0;
        for (let j = 0; j < binsPerBar; j++) sum += data[i * binsPerBar + j] ?? 0;
        const level = sum / binsPerBar / 255; // 0..1
        const el = barRefs.current[i];
        if (el) el.style.height = `${MIN_HEIGHT_PX + level * (MAX_HEIGHT_PX - MIN_HEIGHT_PX)}px`;
      }
      rafId = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      audioContext.close().catch(() => {});
    };
  }, [active, stream]);

  return (
    <div className="flex items-end justify-center gap-[3px] h-10">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            barRefs.current[i] = el;
          }}
          className={cn(
            "w-[3px] rounded-full transition-[height] duration-75 ease-out",
            active ? "bg-primary/80" : "bg-muted-foreground/30"
          )}
          style={{ height: `${MIN_HEIGHT_PX}px` }}
        />
      ))}
    </div>
  );
}
