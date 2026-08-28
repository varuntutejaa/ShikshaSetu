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
  WifiOff,
  Zap,
  Video,
  VideoOff,
  AlertTriangle,
  UserPlus,
  Users,
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
import { Input } from "@/components/ui/input";
import { Waveform } from "@/components/live-class/waveform";
import { cn } from "@/lib/utils";
import { TODAY_CLASS } from "@/lib/mock-data";
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

export function LiveClassroom() {
  const [studentLanguage, setStudentLanguage] = useState("Santhali");
  const [showTranscript, setShowTranscript] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [studentName, setStudentName] = useState("");
  const [creatingClass, setCreatingClass] = useState(false);
  const [joiningClass, setJoiningClass] = useState(false);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [classHistory, setClassHistory] = useState<ClassSession[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [lessonContext, setLessonContext] = useState<Record<string, unknown> | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [voiceDirection, setVoiceDirection] = useState<"teacher_to_student" | "student_to_teacher">("teacher_to_student");

  const audio = useClassroomAudio();
  // Destructure the ref out separately from the rest of the hook's return —
  // keeping a ref bundled into an otherwise-reactive object makes the
  // linter (correctly) treat every property on it as potentially
  // ref-derived, which blocks reading any of them during render.
  const { videoRef, ...video } = useClassroomVideo();
  const sessionIdRef = useRef<string | null>(null);
  const presenceRef = useRef<(WebSocket & { setContent?: (lessonId: string | null, slideIndex: number) => void }) | null>(null);

  const listening = audio.phase !== "idle" || starting;

  useEffect(() => {
    listClassroomSessions()
      .then(setClassHistory)
      .catch(() => {
        // History is helpful context, but should never block the live room.
      });
  }, []);

  function openPresence(sessionId: string, name = "Teacher") {
    presenceRef.current?.close();
    presenceRef.current = connectClassroomPresenceSocket(
      sessionId,
      { type: "teacher", name },
      {
        onEvent(event) {
          if (event.type === "presence_snapshot") setParticipants(event.participants);
          if (event.type === "participant_joined") {
            setParticipants((current) => [event.participant, ...current]);
          }
          if (event.type === "participant_left") {
            setParticipants((current) => [event.participant, ...current]);
          }
          if (event.type === "content_changed") {
            setSlideIndex(event.slide_index);
          }
        },
      }
    );
    listClassroomParticipants(sessionId).then(setParticipants).catch(() => {});
  }

  async function handleCreateClass() {
    setCreatingClass(true);
    setSessionError(null);
    try {
      const created = await createClassroom({
        name: `${TODAY_CLASS.class} ${TODAY_CLASS.subject}`,
        grade: 2,
        section: "A",
        subject_focus: TODAY_CLASS.subject,
        teacher_language: LANGUAGE_NAME_TO_CODE[TODAY_CLASS.teacherLanguage] ?? "hi",
        student_language: LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat",
      });
      setClassroom(created);
      setJoinCode(created.class_code);
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not create class.");
    } finally {
      setCreatingClass(false);
    }
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
      }
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not join class.");
    } finally {
      setJoiningClass(false);
    }
  }

  async function handleStart() {
    setStarting(true);
    setSessionError(null);
    try {
      const classForSession = classroom ?? await createClassroom({
        name: `${TODAY_CLASS.class} ${TODAY_CLASS.subject}`,
        grade: 2,
        section: "A",
        subject_focus: TODAY_CLASS.subject,
        teacher_language: LANGUAGE_NAME_TO_CODE[TODAY_CLASS.teacherLanguage] ?? "hi",
        student_language: LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat",
      });
      setClassroom(classForSession);
      const session = await startClassroom(classForSession.id);
      sessionIdRef.current = session.session_id;
      openPresence(session.session_id);
      const context = lessonContext ?? {
        class: classForSession.name ?? TODAY_CLASS.class,
        subject: TODAY_CLASS.subject,
        topic: TODAY_CLASS.topic,
        activity: "Live classroom explanation",
        learning_objectives: [],
      };

      // Two independent pipelines, started in parallel — a failure in one
      // (e.g. video unconfigured) never blocks or affects the other.
      await Promise.all([
        audio.start(session.session_id, session.teacher_language, session.student_language, context),
        video.start(session.session_id),
      ]);
    } catch (err) {
      setSessionError(
        err instanceof ApiError ? err.message : "Could not reach the ShikshaSetu backend."
      );
    } finally {
      setStarting(false);
    }
  }

  async function handleEndClass() {
    audio.stop();
    video.stop();
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

  function handleToggleListening() {
    if (listening) {
      handleEndClass();
    } else {
      handleStart();
    }
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

  function handleVoiceDirectionChange(value: "teacher_to_student" | "student_to_teacher") {
    setVoiceDirection(value);
    const teacherLanguageCode = LANGUAGE_NAME_TO_CODE[TODAY_CLASS.teacherLanguage] ?? "hi";
    const studentLanguageCode = LANGUAGE_NAME_TO_CODE[studentLanguage] ?? "sat";
    if (value === "teacher_to_student") {
      audio.setDirection(teacherLanguageCode, studentLanguageCode, lessonContext ?? undefined);
    } else {
      audio.setDirection(studentLanguageCode, teacherLanguageCode, lessonContext ?? undefined);
    }
  }

  const isTeacherVisible = listening && !audio.muted && audio.phase !== "idle" && !!audio.teacherText;
  const isStudentVisible = isTeacherVisible && audio.phase === "delivered";

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
                {audio.history.map((h, i) => (
                  <div
                    key={`${h.time}-${i}`}
                    className="rounded-lg border border-border p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground">{h.time}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(h.latencyMs / 1000).toFixed(1)}s
                      </p>
                    </div>
                    <p className="text-sm text-foreground">{h.teacherText}</p>
                    <p className="text-sm text-primary">{h.studentText}</p>
                  </div>
                ))}
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

      <div className="rounded-xl border border-border bg-card p-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div>
          <Label htmlFor="join-code" className="text-sm font-medium">
            Class Code
          </Label>
          <Input
            id="join-code"
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Enter or create code"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="student-name" className="text-sm font-medium">
            Student Name
          </Label>
          <Input
            id="student-name"
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="For join flow"
            className="mt-1"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCreateClass} disabled={creatingClass || listening} className="gap-2">
            <UserPlus className="h-4 w-4" />
            {creatingClass ? "Creating…" : "Create Class"}
          </Button>
          <Button onClick={handleJoinClass} disabled={joiningClass || !joinCode || listening} variant="outline">
            {joiningClass ? "Joining…" : "Join Class"}
          </Button>
        </div>
        {classroom && (
          <p className="text-sm text-muted-foreground md:col-span-3">
            {classroom.name ?? TODAY_CLASS.class} · Code <span className="font-semibold text-foreground">{classroom.class_code}</span>
          </p>
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
          <Select value={voiceDirection} onValueChange={handleVoiceDirectionChange}>
            <SelectTrigger size="sm" className="w-[230px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="teacher_to_student">Teacher Hindi → Student language</SelectItem>
              <SelectItem value="student_to_teacher">Student language → Teacher Hindi</SelectItem>
            </SelectContent>
          </Select>
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

        {/* Central mic interface */}
        <div className="flex flex-1 flex-col items-center justify-center py-4 sm:py-6 w-full">
          <button
            onClick={handleToggleListening}
            aria-label={listening ? "End Live Class" : "Start Live Class"}
            disabled={starting}
            className={cn(
              "relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-full transition-colors",
              listening
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
              starting && "opacity-70"
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
          <p className="mt-4 text-lg font-semibold text-foreground text-center">
            {starting
              ? "Starting Live Class…"
              : !listening
                ? "Tap to Start Live Class"
                : audio.muted
                  ? "🔇 Microphone Muted"
                  : audio.phase === "translating"
                    ? "⚡ Translating…"
                    : "🎙️ Listening"}
          </p>
          <div className="mt-2">
            <Waveform active={listening && !audio.muted && audio.phase !== "idle"} />
          </div>
          {listening && !audio.muted && audio.latencyMs !== null && (
            <p
              className={cn(
                "mt-1 text-xs",
                audio.isLatencyHigh ? "text-destructive font-medium" : "text-muted-foreground"
              )}
            >
              {audio.isLatencyHigh ? "⚠️" : "⚡"} Translation latency: {(audio.latencyMs / 1000).toFixed(1)}s
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
              {TODAY_CLASS.teacherLanguage}
            </Badge>
          </div>
          <div className="flex-1 flex items-center">
            {isTeacherVisible ? (
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
            {isStudentVisible ? (
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

      {/* Live transcript */}
      {showTranscript && (
        <div className="rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Live Transcript
          </p>
          <div className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm text-foreground/80">
            {isTeacherVisible ? (
              <span>{audio.teacherText}</span>
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
            disabled={starting}
            className="gap-2"
          >
            {listening ? <Pause className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {listening ? "Stop Microphone" : "Start Microphone"}
          </Button>

          <Button
            onClick={() => audio.setMuted((m) => !m)}
            variant="outline"
            className="gap-2"
            disabled={!listening}
          >
            {audio.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {audio.muted ? "Unmute" : "Mute"}
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
