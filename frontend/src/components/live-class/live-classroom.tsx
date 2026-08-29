"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Mic,
  MicOff,
  History,
  PhoneOff,
  Wifi,
  WifiOff,
  Zap,
  Video,
  VideoOff,
  AlertTriangle,
  UserPlus,
  Users,
  Smartphone,
  PhoneCall,
  Ear,
  Clock,
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
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Waveform } from "@/components/live-class/waveform";
import { cn } from "@/lib/utils";
import { CLASSES, SUBJECTS } from "@/lib/mock-data";
import {
  ApiError,
  Classroom,
  ClassroomParticipant,
  ClassSession,
  createClassroom,
  endClassroomSession,
  getLesson,
  joinClassroom,
  LANGUAGE_NAME_TO_CODE,
  listClassroomParticipants,
  listClassroomSessions,
  setClassroomContent,
  startClassroom,
} from "@/lib/api";
import { connectClassroomPresenceSocket } from "@/lib/classroom-socket";
import { useClassroomAudio } from "@/hooks/use-classroom-audio";
import { useClassroomVideo } from "@/hooks/use-classroom-video";
import { useClassroomCall } from "@/hooks/use-classroom-call";

// The one fixed product constraint (Hindi-speaking teacher, per the PS) —
// not sample/mock data, so it lives here as a real constant rather than
// coming from the dashboard's demo dataset.
const TEACHER_LANGUAGE = "Hindi";

// A live class runs for a fixed 60 minutes, then ends itself automatically.
const CLASS_DURATION_SEC = 60 * 60;

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LiveClassroom() {
  const [className, setClassName] = useState("");
  const [grade, setGrade] = useState("Class 2");
  const [subjectFocus, setSubjectFocus] = useState("Mathematics");
  const [studentLanguage, setStudentLanguage] = useState("Santhali");
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [joiningClass, setJoiningClass] = useState(false);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number | null>(null);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [classHistory, setClassHistory] = useState<ClassSession[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [lessonContext, setLessonContext] = useState<Record<string, unknown> | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  const audio = useClassroomAudio();
  // Destructure the ref out separately from the rest of the hook's return —
  // keeping a ref bundled into an otherwise-reactive object makes the
  // linter (correctly) treat every property on it as potentially
  // ref-derived, which blocks reading any of them during render.
  const { videoRef, ...video } = useClassroomVideo();
  const call = useClassroomCall();
  const sessionIdRef = useRef<string | null>(null);
  const presenceRef = useRef<(WebSocket & { setContent?: (lessonId: string | null, slideIndex: number) => void }) | null>(null);
  // One real mic capture shared by both audio pipelines (AI translation +
  // raw call) instead of each opening its own getUserMedia — two
  // independent concurrent captures fight over echo-cancellation/AGC on
  // the same physical mic, a real cause of degraded/choppy audio. Owned
  // here, not by either hook, so it's stopped exactly once.
  const sharedMicStreamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const listening = audio.phase !== "idle" || starting;
  const micMuted = audio.muted;

  useEffect(() => {
    listClassroomSessions()
      .then(setClassHistory)
      .catch(() => {
        // History is helpful context, but should never block the live room.
      });
  }, []);

  useEffect(
    () => () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    },
    []
  ); // clear the countdown on unmount

  function openPresence(sessionId: string, name = "Teacher") {
    presenceRef.current?.close();
    presenceRef.current = connectClassroomPresenceSocket(
      sessionId,
      { type: "teacher", name },
      {
        onEvent(event) {
          if (event.type === "presence_snapshot") setParticipants(event.participants);
          if (event.type === "participant_joined" || event.type === "participant_left") {
            // Upsert by id — a reconnect or a snapshot arriving close to a
            // join/leave event can otherwise produce two list entries for
            // the same participant with the same key (React's "duplicate
            // key" warning, and the older entry never goes away).
            setParticipants((current) => [
              event.participant,
              ...current.filter((p) => p.id !== event.participant.id),
            ]);
          }
          if (event.type === "content_changed") {
            setSlideIndex(event.slide_index);
          }
        },
      }
    );
    listClassroomParticipants(sessionId).then(setParticipants).catch(() => {});
  }

  function buildClassInput() {
    const gradeNumber = Number(grade.replace(/\D/g, "")) || 1;
    return {
      name: className.trim() || `${grade} ${subjectFocus}`,
      grade: gradeNumber,
      section: undefined,
      subject_focus: subjectFocus,
      teacher_language: LANGUAGE_NAME_TO_CODE[TEACHER_LANGUAGE] ?? "hi",
      student_language: LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat",
    };
  }

  function startTimer() {
    setTimeRemainingSec(CLASS_DURATION_SEC);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimeRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
          handleEndClass();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  // Create Class goes straight live — no separate "start" step: creates the
  // classroom, starts its session, and immediately turns on the mic and
  // camera (three independent pipelines: AI translation, LiveKit video, and
  // the real raw voice call — a failure in one never blocks the others).
  async function handleCreateClass() {
    setStarting(true);
    setSessionError(null);
    try {
      const created = classroom ?? (await createClassroom(buildClassInput()));
      setClassroom(created);
      setJoinCode(created.class_code);

      const session = await startClassroom(created.id);
      sessionIdRef.current = session.session_id;
      openPresence(session.session_id);
      const context = lessonContext ?? {
        class: created.name,
        subject: created.subject_focus,
        topic: created.subject_focus,
        activity: "Live classroom explanation",
        learning_objectives: [],
      };

      // One real getUserMedia call, shared by both audio pipelines — see
      // sharedMicStreamRef above. If this fails (permission denied etc.),
      // leave it undefined; each hook falls back to requesting its own
      // stream and surfaces its own error message.
      try {
        sharedMicStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        sharedMicStreamRef.current = null;
      }
      const sharedMic = sharedMicStreamRef.current ?? undefined;

      await Promise.all([
        audio.start(session.session_id, session.teacher_language, session.student_language, context, sharedMic),
        video.start(session.session_id),
        call.start(session.session_id, "teacher", sharedMic),
      ]);

      startTimer();
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not start the class.");
    } finally {
      setStarting(false);
    }
  }

  function handleToggleMute() {
    const next = !micMuted;
    audio.setMuted(next);
    call.setMuted(next);
  }

  async function handleJoinClass() {
    setJoiningClass(true);
    setSessionError(null);
    try {
      const joined = await joinClassroom(joinCode, undefined, studentName || "Student");
      setClassroom(joined.classroom);
      if (joined.active_session) {
        sessionIdRef.current = joined.active_session.session_id;
        openPresence(joined.active_session.session_id, studentName || "Student");
        // Lets two website tabs actually hear each other (e.g. to test the
        // live call without an Android device) — the tab that joined
        // connects to the raw call as the student side, symmetric with the
        // "teacher" side that Start Live Class connects.
        call.start(joined.active_session.session_id, "student");
      }
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not join class.");
    } finally {
      setJoiningClass(false);
    }
  }

  async function handleEndClass() {
    audio.stop();
    video.stop();
    call.stop();
    sharedMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    sharedMicStreamRef.current = null;
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimeRemainingSec(null);
    presenceRef.current?.close();
    presenceRef.current = null;
    if (sessionIdRef.current) {
      endClassroomSession(sessionIdRef.current).catch(() => {
        // Best-effort — the client-side pipelines are already torn down.
      });
      sessionIdRef.current = null;
    }
    setParticipants([]);
    listClassroomSessions(classroom?.id).then(setClassHistory).catch(() => {});
  }

  async function handleLoadLesson() {
    if (!lessonId) return;
    try {
      const lesson = await getLesson(lessonId);
      const context = {
        class: `Class ${lesson.grade}`,
        subject: lesson.subject,
        topic: lesson.topic,
        activity: lesson.activity,
        learning_objectives: lesson.learning_objectives,
      };
      setLessonContext(context);
      setSlideIndex(0);
      if (sessionIdRef.current) {
        await setClassroomContent(sessionIdRef.current, lesson.id, 0);
        presenceRef.current?.setContent?.(lesson.id, 0);
      }
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not load lesson context.");
    }
  }

  function handleSlideChange(nextIndex: number) {
    const bounded = Math.max(0, nextIndex);
    setSlideIndex(bounded);
    if (sessionIdRef.current) {
      setClassroomContent(sessionIdRef.current, lessonId || null, bounded).catch(() => {});
      presenceRef.current?.setContent?.(lessonId || null, bounded);
    }
  }

  // Both panels are driven entirely by the backend's broadcast events — the
  // teacher's own persistent connection (role="teacher") receives BOTH
  // directions on the same session_id: teacher_to_student fills these in
  // when the teacher speaks, student_to_teacher fills them in the moment a
  // real separate device (the Android app, connected with role="student" to
  // this same session via the class code below) speaks. No simulation, no
  // manual toggle — whatever a real second device sends shows up here live.
  const isTeacherTextVisible = listening && audio.phase !== "idle" && !!audio.teacherText;
  const isStudentTextVisible = listening && audio.phase !== "idle" && !!audio.studentText;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Live Classroom
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {classroom
              ? `${classroom.name ?? `${grade} ${subjectFocus}`} · ${TEACHER_LANGUAGE} → ${studentLanguage}`
              : `No class started yet · ${TEACHER_LANGUAGE} → ${studentLanguage}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 py-1.5 px-3",
              audio.wsStatus === "connected"
                ? "border-success/25 bg-success/10 text-success"
                : audio.wsStatus === "reconnecting"
                  ? "border-warning/30 bg-warning/10 text-warning-foreground"
                  : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {audio.wsStatus === "connected" ? (
              <Wifi className="h-3.5 w-3.5" />
            ) : (
              <WifiOff className="h-3.5 w-3.5" />
            )}
            {audio.wsStatus === "connected"
              ? "Connected · Sarvam AI"
              : audio.wsStatus === "connecting"
                ? "Connecting…"
                : audio.wsStatus === "reconnecting"
                  ? "Reconnecting…"
                  : "AI Audio Offline"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 py-1.5 px-3",
              video.status === "connected"
                ? "border-success/25 bg-success/10 text-success"
                : "border-border bg-muted/40 text-muted-foreground"
            )}
          >
            {video.status === "connected" ? (
              <Video className="h-3.5 w-3.5" />
            ) : (
              <VideoOff className="h-3.5 w-3.5" />
            )}
            {video.status === "connected"
              ? "Video Live"
              : video.status === "connecting"
                ? "Video Connecting…"
                : video.statusMessage ?? "Video Off"}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "gap-1.5 py-1.5 px-3",
              call.status === "live"
                ? call.remoteSpeaking
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-success/25 bg-success/10 text-success"
                : call.status === "connecting" || call.status === "reconnecting"
                  ? "border-warning/30 bg-warning/10 text-warning-foreground"
                  : "border-border bg-muted/40 text-muted-foreground"
            )}
            title="Raw, untranslated real-time audio — no Sarvam AI, sounds like a phone call"
          >
            {call.remoteSpeaking ? (
              <Ear className="h-3.5 w-3.5 animate-pulse" />
            ) : (
              <PhoneCall className="h-3.5 w-3.5" />
            )}
            {call.status === "live"
              ? call.remoteSpeaking === "student"
                ? "Live Call · Student Speaking"
                : call.remoteSpeaking === "teacher"
                  ? "Live Call · Teacher Speaking"
                  : "Live Call Connected"
              : call.status === "connecting"
                ? "Live Call Connecting…"
                : call.status === "reconnecting"
                  ? "Live Call Reconnecting…"
                  : "Live Call Off"}
          </Badge>
          {timeRemainingSec !== null && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 py-1.5 px-3 tabular-nums",
                timeRemainingSec <= 300
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(timeRemainingSec)} left
            </Badge>
          )}
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
                {audio.history.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Translated exchanges will appear here as the class progresses.
                  </p>
                )}
                {audio.history.map((h, i) => {
                  const fromStudent = h.direction === "student_to_teacher";
                  return (
                    <div
                      key={`${h.time}-${i}`}
                      className="rounded-lg border border-border p-3 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal text-[11px]",
                            fromStudent ? "border-primary/30 text-primary" : "border-border text-foreground"
                          )}
                        >
                          {fromStudent ? "Student" : "Teacher"}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] text-muted-foreground">{h.time}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {(h.latencyMs / 1000).toFixed(1)}s
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground">
                        {fromStudent ? h.studentText : h.teacherText}
                      </p>
                      <p className="text-sm text-primary">
                        {fromStudent ? h.teacherText : h.studentText}
                      </p>
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {sessionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {sessionError}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="class-name" className="text-sm font-medium">
              Class Name
            </Label>
            <Input
              id="class-name"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g. Morning Batch"
              disabled={!!classroom || listening}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-sm font-medium">Grade</Label>
            <Select value={grade} onValueChange={setGrade} disabled={!!classroom || listening}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm font-medium">Subject</Label>
            <Select value={subjectFocus} onValueChange={setSubjectFocus} disabled={!!classroom || listening}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <div>
            <Label htmlFor="join-code" className="text-sm font-medium">
              Class Code
            </Label>
            <Input
              id="join-code"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
              placeholder="Enter a code to join another class"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="student-name" className="text-sm font-medium">
              Your Name (for join flow)
            </Label>
            <Input
              id="student-name"
              value={studentName}
              onChange={(event) => setStudentName(event.target.value)}
              placeholder="Only used when joining"
              className="mt-1"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreateClass} disabled={starting || !!classroom || listening} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {starting ? "Starting…" : "Create Class"}
            </Button>
            <Button onClick={handleJoinClass} disabled={joiningClass || !joinCode || listening} variant="outline">
              {joiningClass ? "Joining…" : "Join Class"}
            </Button>
          </div>
        </div>

        {classroom && (
          <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3.5 py-3">
            <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              {classroom.name} · Code{" "}
              <span className="font-semibold text-primary">{classroom.class_code}</span>
              <br />
              <span className="text-muted-foreground">
                Enter this code in the Android app&apos;s &quot;Join Class&quot; screen once the class is
                started — the app connects to this exact same live session for real two-way voice.
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 grid gap-3 lg:grid-cols-[1fr_auto_auto] lg:items-end">
        <div>
          <Label htmlFor="lesson-id" className="text-sm font-medium">
            Lesson / Deck
          </Label>
          <Input
            id="lesson-id"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
            placeholder="Paste generated lesson id"
            className="mt-1"
          />
        </div>
        <Button onClick={handleLoadLesson} variant="outline" disabled={!lessonId}>
          Use Lesson Context
        </Button>
        <div className="flex gap-2">
          <Button onClick={() => handleSlideChange(slideIndex - 1)} variant="outline" disabled={slideIndex === 0}>
            Previous
          </Button>
          <Button onClick={() => handleSlideChange(slideIndex + 1)} variant="outline">
            Next Slide
          </Button>
        </div>
        <div className="lg:col-span-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">Slide {slideIndex + 1}</Badge>
          {lessonContext && (
            <span>
              Context: {String(lessonContext.subject)} · {String(lessonContext.topic)}
            </span>
          )}
        </div>
      </div>
      {audio.errorMessage && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {audio.errorMessage}
        </div>
      )}
      {call.errorMessage && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2.5 text-sm text-warning-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {call.errorMessage}
        </div>
      )}

      {/* Camera preview */}
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="relative w-full sm:w-64 aspect-video rounded-2xl border border-border bg-muted overflow-hidden shrink-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn("h-full w-full object-cover", video.hasPreview ? "block" : "hidden")}
          />
          {!video.hasPreview && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
              <VideoOff className="h-6 w-6" />
              <p className="text-xs text-center px-4">
                {listening ? video.statusMessage ?? "Camera preview unavailable" : "Camera preview"}
              </p>
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-black/60 text-white border-0 text-[11px] font-normal">
            Teacher Camera
          </Badge>
        </div>

        {/* Central mic interface — tap to mute/unmute. Starting the class
            itself happens from Create Class above, not here. */}
        <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-6 w-full">
          {listening ? (
            <>
              <button
                onClick={handleToggleMute}
                aria-label={micMuted ? "Unmute microphone" : "Mute microphone"}
                className={cn(
                  "relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full transition-colors",
                  micMuted
                    ? "bg-muted text-muted-foreground hover:bg-muted/70"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {!micMuted && (
                  <span className="absolute inset-0 rounded-full animate-pulse-ring" />
                )}
                {micMuted ? (
                  <MicOff className="h-11 w-11 sm:h-12 sm:w-12" />
                ) : (
                  <Mic className="h-11 w-11 sm:h-12 sm:w-12" />
                )}
              </button>
              <p className="mt-4 text-lg font-semibold text-foreground text-center">
                {micMuted ? "🔇 Muted — tap to unmute" : "🎙️ Live — tap to mute"}
              </p>
              <div className="mt-2">
                <Waveform active={!micMuted} />
              </div>
              {!micMuted && audio.latencyMs !== null && (
                <p
                  className={cn(
                    "mt-1 text-xs",
                    audio.isLatencyHigh ? "text-destructive font-medium" : "text-muted-foreground"
                  )}
                >
                  {audio.isLatencyHigh ? "⚠️" : "⚡"} Translation latency: {(audio.latencyMs / 1000).toFixed(1)}s
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {starting
                ? "Starting live class…"
                : "Fill in the class details above and click Create Class to go live — your microphone and camera start automatically."}
            </p>
          )}
        </div>
      </div>

      {/* Dual panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-card p-5 min-h-[180px] flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Teacher Speech</p>
            <Badge variant="secondary" className="font-normal">
              {TEACHER_LANGUAGE}
            </Badge>
          </div>
          <div className="flex-1 flex items-center">
            {isTeacherTextVisible ? (
              <p className="text-lg leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                “{audio.teacherText}”
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
            <Select value={studentLanguage} onValueChange={setStudentLanguage} disabled={listening}>
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
            {isStudentTextVisible ? (
              <p className="text-lg leading-relaxed text-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
                “{audio.studentText}”
              </p>
            ) : audio.phase === "translating" ? (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-foreground">Participants</p>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {participants.filter((p) => p.status === "online").length} live
            </Badge>
          </div>
          <div className="space-y-2">
            {participants.length === 0 ? (
              <p className="text-sm text-muted-foreground">Students will appear here as they join.</p>
            ) : (
              participants.slice(0, 8).map((participant) => (
                <div key={participant.id} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{participant.display_name}</span>
                  <Badge variant="outline" className={participant.status === "online" ? "text-success" : "text-muted-foreground"}>
                    {participant.status === "online" ? "Joined" : "Left"}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold text-foreground mb-3">Active & Past Classes</p>
          <div className="space-y-2">
            {classHistory.slice(0, 5).map((session) => (
              <div key={session.session_id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{new Date(session.created_at).toLocaleString()}</span>
                <Badge variant={session.status === "active" ? "default" : "secondary"}>{session.status}</Badge>
              </div>
            ))}
            {classHistory.length === 0 && (
              <p className="text-sm text-muted-foreground">Class history will appear after sessions start.</p>
            )}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={handleToggleMute}
            variant="outline"
            className="gap-2"
            disabled={!listening}
          >
            {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {micMuted ? "Unmute" : "Mute"}
          </Button>

          <Button
            onClick={video.toggleCamera}
            variant="outline"
            className="gap-2"
            disabled={video.status !== "connected"}
          >
            {video.cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            {video.cameraOn ? "Camera On" : "Camera Off"}
          </Button>
        </div>

        <Button asChild variant="destructive" className="gap-2" onClick={handleEndClass}>
          <Link href="/dashboard">
            <PhoneOff className="h-4 w-4" />
            End Class
          </Link>
        </Button>
      </div>
    </div>
  );
}
