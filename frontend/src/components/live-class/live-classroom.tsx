"use client";

import { useEffect, useRef, useState } from "react";
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
  Users,
  Smartphone,
  PhoneCall,
  Ear,
  Clock,
  MessageSquare,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  X,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useTeacherAuth } from "@/lib/teacher-auth";
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

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type SidePanel = "people" | "live" | "lesson" | null;

export function LiveClassroom() {
  const { teacher } = useTeacherAuth();
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
  const [activePanel, setActivePanel] = useState<SidePanel>("live");

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
    setClassroom(null);
    listClassroomSessions().then(setClassHistory).catch(() => {});
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
  const onlineCount = participants.filter((p) => p.status === "online").length;

  if (!listening) {
    return (
      <LobbyView
        className={className}
        setClassName={setClassName}
        grade={grade}
        setGrade={setGrade}
        subjectFocus={subjectFocus}
        setSubjectFocus={setSubjectFocus}
        studentLanguage={studentLanguage}
        setStudentLanguage={setStudentLanguage}
        sessionError={sessionError}
        starting={starting}
        classroom={classroom}
        joinCode={joinCode}
        setJoinCode={setJoinCode}
        studentName={studentName}
        setStudentName={setStudentName}
        joiningClass={joiningClass}
        classHistory={classHistory}
        onCreateClass={handleCreateClass}
        onJoinClass={handleJoinClass}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Slim top bar */}
      <div className="h-14 shrink-0 border-b border-border bg-card px-3 sm:px-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {classroom?.name ?? `${grade} ${subjectFocus}`}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {classroom ? `Code ${classroom.class_code} · ` : ""}
            {TEACHER_LANGUAGE} → {studentLanguage}
          </p>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {timeRemainingSec !== null && (
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 py-1.5 px-2.5 tabular-nums hidden sm:flex",
                timeRemainingSec <= 300
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/40 text-muted-foreground"
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(timeRemainingSec)}
            </Badge>
          )}
          <StatusDot
            ok={audio.wsStatus === "connected"}
            warn={audio.wsStatus === "reconnecting"}
            icon={audio.wsStatus === "connected" ? Wifi : WifiOff}
            label={
              audio.wsStatus === "connected"
                ? "Connected · Sarvam AI"
                : audio.wsStatus === "connecting"
                  ? "Connecting…"
                  : audio.wsStatus === "reconnecting"
                    ? "Reconnecting…"
                    : "AI Audio Offline"
            }
          />
          <StatusDot
            ok={video.status === "connected"}
            warn={false}
            icon={video.status === "connected" ? Video : VideoOff}
            label={
              video.status === "connected"
                ? "Video Live"
                : video.status === "connecting"
                  ? "Video Connecting…"
                  : video.statusMessage ?? "Video Off"
            }
          />
          <StatusDot
            ok={call.status === "live"}
            warn={call.status === "connecting" || call.status === "reconnecting"}
            icon={call.remoteSpeaking ? Ear : PhoneCall}
            label={
              call.status === "live"
                ? call.remoteSpeaking === "student"
                  ? "Live Call · Student Speaking"
                  : call.remoteSpeaking === "teacher"
                    ? "Live Call · Teacher Speaking"
                    : "Live Call Connected"
                : call.status === "connecting"
                  ? "Live Call Connecting…"
                  : call.status === "reconnecting"
                    ? "Live Call Reconnecting…"
                    : "Live Call Off"
            }
          />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Conversation history">
                <History className="h-4 w-4" />
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
                    <div key={`${h.time}-${i}`} className="rounded-lg border border-border p-3 space-y-1.5">
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
                          <p className="text-[11px] text-muted-foreground">{(h.latencyMs / 1000).toFixed(1)}s</p>
                        </div>
                      </div>
                      <p className="text-sm text-foreground">{fromStudent ? h.studentText : h.teacherText}</p>
                      <p className="text-sm text-primary">{fromStudent ? h.teacherText : h.studentText}</p>
                    </div>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {(sessionError || audio.errorMessage || call.errorMessage) && (
        <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning-foreground flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {sessionError || audio.errorMessage || call.errorMessage}
        </div>
      )}

      {/* Stage + side panel */}
      <div className="flex-1 min-h-0 flex">
        {/* Video stage */}
        <div className="flex-1 min-w-0 relative bg-neutral-900 flex items-center justify-center p-3 sm:p-6">
          <div className="relative w-full h-full max-w-4xl rounded-2xl overflow-hidden bg-neutral-800 flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn("h-full w-full object-cover", video.hasPreview ? "block" : "hidden")}
            />
            {!video.hasPreview && (
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl font-semibold">
                    {teacher ? initials(teacher.name) : "T"}
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm text-neutral-400 text-center px-6">
                  {video.statusMessage ?? "Camera preview unavailable"}
                </p>
              </div>
            )}

            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span className="rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {teacher?.name ?? "You"}
              </span>
              {micMuted && (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-white">
                  <MicOff className="h-3.5 w-3.5" />
                </span>
              )}
            </div>

            {!micMuted && (
              <div className="absolute bottom-3 right-3">
                <Waveform active={!micMuted} />
              </div>
            )}
          </div>
        </div>

        {/* Side panel */}
        {activePanel && (
          <div className="w-full sm:w-80 shrink-0 border-l border-border bg-card flex flex-col absolute sm:static inset-0 sm:inset-auto z-20">
            <Tabs value={activePanel} onValueChange={(v) => setActivePanel(v as SidePanel)} className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center justify-between px-3 pt-3">
                <TabsList>
                  <TabsTrigger value="live" className="gap-1.5 text-xs">
                    <MessageSquare className="h-3.5 w-3.5" /> Live
                  </TabsTrigger>
                  <TabsTrigger value="people" className="gap-1.5 text-xs">
                    <Users className="h-3.5 w-3.5" /> People
                  </TabsTrigger>
                  <TabsTrigger value="lesson" className="gap-1.5 text-xs">
                    <BookOpen className="h-3.5 w-3.5" /> Lesson
                  </TabsTrigger>
                </TabsList>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={() => setActivePanel(null)}
                  aria-label="Close panel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <TabsContent value="live" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                <div className="rounded-xl border border-border bg-background p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground">Teacher Speech</p>
                    <Badge variant="secondary" className="font-normal text-[11px]">
                      {TEACHER_LANGUAGE}
                    </Badge>
                  </div>
                  {isTeacherTextVisible ? (
                    <p className="text-sm leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                      “{audio.teacherText}”
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Waiting for teacher&apos;s voice input…</p>
                  )}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
                  <p className="text-xs font-semibold text-foreground mb-2">Student Language · {studentLanguage}</p>
                  {isStudentTextVisible ? (
                    <p className="text-sm leading-relaxed text-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
                      “{audio.studentText}”
                    </p>
                  ) : audio.phase === "translating" ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 animate-pulse text-primary" />
                      Translating voice-to-voice…
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Translated speech will appear here in real time.</p>
                  )}
                </div>

                {!micMuted && audio.latencyMs !== null && (
                  <p
                    className={cn(
                      "text-xs px-1",
                      audio.isLatencyHigh ? "text-destructive font-medium" : "text-muted-foreground"
                    )}
                  >
                    {audio.isLatencyHigh ? "⚠️" : "⚡"} Translation latency: {(audio.latencyMs / 1000).toFixed(1)}s
                  </p>
                )}
              </TabsContent>

              <TabsContent value="people" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                {classroom && (
                  <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
                    <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground">
                      Code <span className="font-semibold text-primary">{classroom.class_code}</span>
                      <br />
                      <span className="text-muted-foreground">
                        Students join with this code in the Android app.
                      </span>
                    </p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Participants</p>
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Users className="h-3 w-3" />
                    {onlineCount} live
                  </Badge>
                </div>
                {participants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Students will appear here as they join.</p>
                ) : (
                  <div className="space-y-2">
                    {participants.slice(0, 12).map((participant) => (
                      <div key={participant.id} className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{participant.display_name}</span>
                        <Badge
                          variant="outline"
                          className={participant.status === "online" ? "text-success" : "text-muted-foreground"}
                        >
                          {participant.status === "online" ? "Joined" : "Left"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="lesson" className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lesson-id" className="text-xs font-medium">
                    Lesson / Deck
                  </Label>
                  <Input
                    id="lesson-id"
                    value={lessonId}
                    onChange={(event) => setLessonId(event.target.value)}
                    placeholder="Paste generated lesson id"
                  />
                  <Button onClick={handleLoadLesson} variant="outline" size="sm" disabled={!lessonId} className="w-full">
                    Use Lesson Context
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button
                    onClick={() => handleSlideChange(slideIndex - 1)}
                    variant="outline"
                    size="sm"
                    disabled={slideIndex === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </Button>
                  <Badge variant="secondary">Slide {slideIndex + 1}</Badge>
                  <Button onClick={() => handleSlideChange(slideIndex + 1)} variant="outline" size="sm" className="gap-1">
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {lessonContext && (
                  <p className="text-xs text-muted-foreground">
                    Context: {String(lessonContext.subject)} · {String(lessonContext.topic)}
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Floating control bar */}
      <div className="shrink-0 bg-neutral-900 px-4 py-3 flex items-center justify-center gap-3">
        <ControlButton
          active={!micMuted}
          onClick={handleToggleMute}
          icon={micMuted ? MicOff : Mic}
          label={micMuted ? "Unmute" : "Mute"}
          danger={micMuted}
        />
        <ControlButton
          active={video.cameraOn}
          onClick={video.toggleCamera}
          icon={video.cameraOn ? Video : VideoOff}
          label={video.cameraOn ? "Camera On" : "Camera Off"}
          danger={!video.cameraOn}
          disabled={video.status !== "connected"}
        />
        <ControlButton
          active={activePanel === "people"}
          onClick={() => setActivePanel((p) => (p === "people" ? null : "people"))}
          icon={Users}
          label="People"
          badge={onlineCount > 0 ? onlineCount : undefined}
        />
        <ControlButton
          active={activePanel === "live"}
          onClick={() => setActivePanel((p) => (p === "live" ? null : "live"))}
          icon={MessageSquare}
          label="Live"
        />
        <button
          onClick={handleEndClass}
          aria-label="End Class"
          className="flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          End Class
        </button>
      </div>
    </div>
  );
}

function StatusDot({
  ok,
  warn,
  icon: Icon,
  label,
}: {
  ok: boolean;
  warn: boolean;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border",
        ok
          ? "border-success/25 bg-success/10 text-success"
          : warn
            ? "border-warning/30 bg-warning/10 text-warning-foreground"
            : "border-border bg-muted/40 text-muted-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  icon: Icon,
  label,
  danger,
  disabled,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
        danger
          ? "bg-destructive/90 text-white hover:bg-destructive"
          : active
            ? "bg-neutral-700 text-white hover:bg-neutral-600"
            : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
      {badge !== undefined && (
        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
          {badge}
        </span>
      )}
    </button>
  );
}

interface LobbyViewProps {
  className: string;
  setClassName: (v: string) => void;
  grade: string;
  setGrade: (v: string) => void;
  subjectFocus: string;
  setSubjectFocus: (v: string) => void;
  studentLanguage: string;
  setStudentLanguage: (v: string) => void;
  sessionError: string | null;
  starting: boolean;
  classroom: Classroom | null;
  joinCode: string;
  setJoinCode: (v: string) => void;
  studentName: string;
  setStudentName: (v: string) => void;
  joiningClass: boolean;
  classHistory: ClassSession[];
  onCreateClass: () => void;
  onJoinClass: () => void;
}

function LobbyView({
  className,
  setClassName,
  grade,
  setGrade,
  subjectFocus,
  setSubjectFocus,
  studentLanguage,
  setStudentLanguage,
  sessionError,
  starting,
  classroom,
  joinCode,
  setJoinCode,
  studentName,
  setStudentName,
  joiningClass,
  classHistory,
  onCreateClass,
  onJoinClass,
}: LobbyViewProps) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-10 sm:py-16">
        <div className="text-center mb-7">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Video className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Start a Live Class</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {TEACHER_LANGUAGE} → {studentLanguage}, translated live for your students
          </p>
        </div>

        {sessionError && (
          <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {sessionError}
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4">
          <div>
            <Label htmlFor="class-name" className="text-sm font-medium">
              Class Name
            </Label>
            <Input
              id="class-name"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
              placeholder="e.g. Morning Batch"
              disabled={!!classroom}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm font-medium">Grade</Label>
              <Select value={grade} onValueChange={setGrade} disabled={!!classroom}>
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
              <Select value={subjectFocus} onValueChange={setSubjectFocus} disabled={!!classroom}>
                <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Student Language</Label>
            <Select value={studentLanguage} onValueChange={setStudentLanguage} disabled={!!classroom}>
              <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Ho">Ho</SelectItem>
                <SelectItem value="Mundari">Mundari</SelectItem>
                <SelectItem value="Santhali">Santhali</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={onCreateClass} disabled={starting} size="lg" className="w-full h-12 gap-2 text-base font-semibold">
            {starting ? "Starting…" : "Create Class"}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Your microphone and camera start automatically.
          </p>
        </div>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2.5 text-muted-foreground">or join another class</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-3">
          <Input
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            placeholder="Class code"
          />
          <Input
            value={studentName}
            onChange={(event) => setStudentName(event.target.value)}
            placeholder="Your name (for the join flow)"
          />
          <Button onClick={onJoinClass} disabled={joiningClass || !joinCode} variant="outline" className="w-full">
            {joiningClass ? "Joining…" : "Join Class"}
          </Button>
        </div>

        {classHistory.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
              Recent Classes
            </p>
            <div className="rounded-xl border border-border bg-card divide-y divide-border">
              {classHistory.slice(0, 5).map((session) => (
                <div key={session.session_id} className="flex items-center justify-between text-sm px-3.5 py-2.5">
                  <span className="text-muted-foreground">{new Date(session.created_at).toLocaleString()}</span>
                  <Badge variant={session.status === "active" ? "default" : "secondary"}>{session.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
