"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Pause,
  History,
  PhoneOff,
  Wifi,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Waveform } from "@/components/live-class/waveform";
import { cn } from "@/lib/utils";
import { LIVE_CONVERSATION, TODAY_CLASS, type LiveExchange } from "@/lib/mock-data";

type Phase = "idle" | "listening" | "translating" | "delivered";

interface HistoryItem extends LiveExchange {
  time: string;
}

export function LiveClassroom() {
  const [listening, setListening] = useState(false);
  const [muted, setMuted] = useState(false);
  const [studentLanguage, setStudentLanguage] = useState("Santhali");
  const [showTranscript, setShowTranscript] = useState(true);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

  const current = LIVE_CONVERSATION[index % LIVE_CONVERSATION.length];

  useEffect(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];

    if (!listening || muted) {
      return;
    }

    const t0 = setTimeout(() => {
      setPhase("listening");
    }, 0);

    const t1 = setTimeout(() => {
      setPhase("translating");
    }, 1400);

    const t2 = setTimeout(() => {
      setPhase("delivered");
    }, 1400 + current.latencyMs);

    const t3 = setTimeout(() => {
      setHistory((h) => [
        { ...current, time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) },
        ...h,
      ]);
      setIndex((i) => i + 1);
    }, 1400 + current.latencyMs + 2600);

    timeouts.current = [t0, t1, t2, t3];

    return () => {
      timeouts.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, muted, index]);

  function handleToggleListening() {
    if (listening) {
      setListening(false);
      setPhase("idle");
    } else {
      setListening(true);
    }
  }

  const isTeacherVisible = listening && !muted && phase !== "idle";
  const isStudentVisible = isTeacherVisible && phase === "delivered";

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Live Classroom
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {TODAY_CLASS.class} · {TODAY_CLASS.subject} · {TODAY_CLASS.teacherLanguage} → {studentLanguage}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="gap-1.5 border-success/25 bg-success/10 text-success py-1.5 px-3"
          >
            <Wifi className="h-3.5 w-3.5" />
            Connected · Sarvam AI
          </Badge>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <History className="h-4 w-4" />
                History
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Conversation History</SheetTitle>
              </SheetHeader>
              <div className="px-4 pb-6 space-y-3 overflow-y-auto">
                {history.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Translated exchanges will appear here as the class progresses.
                  </p>
                )}
                {history.map((h, i) => (
                  <div
                    key={`${h.id}-${i}`}
                    className="rounded-lg border border-border p-3 space-y-1.5"
                  >
                    <p className="text-[11px] text-muted-foreground">{h.time}</p>
                    <p className="text-sm text-foreground">{h.teacherText}</p>
                    <p className="text-sm text-primary">{h.studentText}</p>
                  </div>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Central mic interface */}
      <div className="flex flex-col items-center justify-center py-6 sm:py-10">
        <button
          onClick={handleToggleListening}
          aria-label={listening ? "Stop microphone" : "Start microphone"}
          className={cn(
            "relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full transition-colors",
            listening
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/70"
          )}
        >
          {listening && (
            <span className="absolute inset-0 rounded-full animate-pulse-ring" />
          )}
          {listening ? (
            <Mic className="h-11 w-11 sm:h-12 sm:w-12" />
          ) : (
            <Pause className="h-11 w-11 sm:h-12 sm:w-12" />
          )}
        </button>
        <p className="mt-4 text-lg font-semibold text-foreground">
          {!listening
            ? "Tap to Start Listening"
            : muted
              ? "🔇 Microphone Muted"
              : phase === "translating"
                ? "⚡ Translating…"
                : "🎙️ Listening"}
        </p>
        <div className="mt-2">
          <Waveform active={listening && !muted} />
        </div>
        {listening && !muted && (
          <p className="mt-1 text-xs text-muted-foreground">
            ⚡ Translation latency: {(current.latencyMs / 1000).toFixed(1)}s
          </p>
        )}
      </div>

      {/* Dual panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 min-h-[180px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Teacher Speech</p>
            <Badge variant="secondary" className="font-normal">
              {TODAY_CLASS.teacherLanguage}
            </Badge>
          </div>
          <div className="flex-1 flex items-center">
            {isTeacherVisible ? (
              <p className="text-lg leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                “{current.teacherText}”
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Waiting for teacher&apos;s voice input…
              </p>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-5 min-h-[180px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Student Language</p>
            <Select value={studentLanguage} onValueChange={setStudentLanguage}>
              <SelectTrigger size="sm" className="w-[110px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Ho">Ho</SelectItem>
                <SelectItem value="Mundari">Mundari</SelectItem>
                <SelectItem value="Santhali">Santhali</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 flex items-center">
            {isStudentVisible ? (
              <p className="text-lg leading-relaxed text-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
                “{current.studentText}”
              </p>
            ) : phase === "translating" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 animate-pulse text-primary" />
                Translating voice-to-voice…
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Translated speech will appear here in real time.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Live transcript */}
      {showTranscript && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Live Transcript
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm text-foreground/80">
            {isTeacherVisible ? (
              <span>{current.teacherText}</span>
            ) : (
              <span className="text-muted-foreground">Transcript will stream here as the teacher speaks.</span>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleToggleListening}
            variant={listening ? "outline" : "default"}
            className="gap-2"
          >
            {listening ? <Pause className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? "Stop Microphone" : "Start Microphone"}
          </Button>

          <Button
            onClick={() => setMuted((m) => !m)}
            variant="outline"
            className="gap-2"
            disabled={!listening}
          >
            {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {muted ? "Unmute" : "Mute"}
          </Button>

          <div className="flex items-center gap-2 pl-1">
            <Switch
              id="transcript"
              checked={showTranscript}
              onCheckedChange={setShowTranscript}
            />
            <Label htmlFor="transcript" className="text-sm text-muted-foreground">
              Live transcript
            </Label>
          </div>
        </div>

        <Button asChild variant="destructive" className="gap-2">
          <Link href="/dashboard">
            <PhoneOff className="h-4 w-4" />
            End Class
          </Link>
        </Button>
      </div>
    </div>
  );
}
