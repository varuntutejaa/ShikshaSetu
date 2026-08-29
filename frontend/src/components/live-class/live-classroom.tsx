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
  Check,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useClassroomAudio, type AudioPhase } from "@/hooks/use-classroom-audio";
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

// The Hindi->Santali pipeline stage this phase represents, in order —
// driven entirely by real events from the backend (segment sent =
// transcribing, "transcript" event received = translating, "audio" event
// received = delivered/complete). Never a timed/fake animation.
const AUDIO_STAGES: { phase: AudioPhase; label: string }[] = [
  { phase: "listening", label: "Listening" },
  { phase: "transcribing", label: "Transcribing" },
  { phase: "translating", label: "Translating" },
  { phase: "delivered", label: "Complete" },
];

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
  // Mirrors sharedMicStreamRef below, reactively — the Waveform visualizer
  // needs to actually receive the stream via props (a ref update alone
  // doesn't trigger a re-render) to start analyzing real audio levels as
  // soon as the mic is ready.
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [timeRemainingSec, setTimeRemainingSec] = useState<number | null>(null);
  const [participants, setParticipants] = useState<ClassroomParticipant[]>([]);
  const [classHistory, setClassHistory] = useState<ClassSession[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [lessonContext, setLessonContext] = useState<Record<string, unknown> | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [activePanel, setActivePanel] = useState<SidePanel>("live");
  // Which side of the call this browser tab is on. Only meaningful once a
  // session is live — defaults to "teacher" since Create Class is the
  // primary flow. Join Class sets this to "student".
  const [myRole, setMyRole] = useState<"teacher" | "student">("teacher");
  // Distinct from `starting` (the teacher's Create Class flag): tracks
  // whether a *joiner* has successfully connected to the raw call. Without
  // this, `listening` below never became true for a joiner (it only looked
  // at the AI pipeline's phase, which Join Class never starts) — the
  // joiner's screen stayed stuck on the Lobby forever even though their
  // call connected in the background. That's also what let a confused user
  // re-click "Join Class" (button never disappeared) and open a second
  // concurrent mic capture + raw-call connection — a real, reproducible
  // cause of doubled/echoey audio.
  const [joinedCall, setJoinedCall] = useState(false);

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

  const listening = audio.phase !== "idle" || starting || joinedCall;
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
    setMyRole("teacher");
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
      setMicStream(sharedMicStreamRef.current);
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
    // Once joined, the Lobby (and this button) unmounts entirely — see
    // `listening` above — but guard here too in case anything else ever
    // calls this while already connected, rather than opening a second
    // concurrent mic capture + raw-call connection.
    if (joinedCall) return;
    setJoiningClass(true);
    setSessionError(null);
    setMyRole("student");
    try {
      const joined = await joinClassroom(joinCode, undefined, studentName || "Student");
      setClassroom(joined.classroom);
      if (!joined.active_session) {
        setSessionError("This class hasn't gone live yet — ask the teacher to start it first.");
        return;
      }
      sessionIdRef.current = joined.active_session.session_id;
      openPresence(joined.active_session.session_id, studentName || "Student");

      // One real getUserMedia call, shared the same way Create Class shares
      // one — see sharedMicStreamRef above. If this fails, leave it
      // undefined; the call hook falls back to requesting its own stream.
      try {
        sharedMicStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        sharedMicStreamRef.current = null;
      }
      setMicStream(sharedMicStreamRef.current);
      const sharedMic = sharedMicStreamRef.current ?? undefined;

      // Lets two website tabs actually hear each other (e.g. to test the
      // live call without an Android device) — the tab that joined
      // connects to the raw call as the student side, symmetric with the
      // "teacher" side that Create Class connects.
      await call.start(joined.active_session.session_id, "student", sharedMic);
      setJoinedCall(true);
    } catch (err) {
      setSessionError(err instanceof ApiError ? err.message : "Could not join class.");
    } finally {
      setJoiningClass(false);
    }
  }

  function handleLeaveClass() {
    // The student side of a joined call: tear down only this browser's own
    // pipelines and return to the Lobby. Deliberately does NOT call
    // endClassroomSession — that ends the session for the teacher and
    // every other participant too, which a joiner must never trigger.
    audio.stop();
    video.stop();
    call.stop();
    sharedMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    sharedMicStreamRef.current = null;
    setMicStream(null);
    presenceRef.current?.close();
    presenceRef.current = null;
    sessionIdRef.current = null;
    setJoinedCall(false);
    setParticipants([]);
    setClassroom(null);
    setJoinCode("");
    setMyRole("teacher");
  }

  async function handleEndClass() {
    audio.stop();
    video.stop();
    call.stop();
    sharedMicStreamRef.current?.getTracks().forEach((t) => t.stop());
    sharedMicStreamRef.current = null;
    setMicStream(null);
    setJoinedCall(false);
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
                <Waveform stream={micStream} active={!micMuted} />
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
                {!micMuted && (
                  <div className="flex items-center gap-1.5 flex-wrap px-1">
                    {AUDIO_STAGES.map((stage) => {
                      const active = audio.phase === stage.phase;
                      const complete = stage.phase === "delivered";
                      return (
                        <span
                          key={stage.phase}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium transition-colors",
                            active
                              ? complete
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                : "bg-primary/15 text-primary"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {complete ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full bg-current",
                                active ? "animate-pulse" : "opacity-40"
                              )}
                            />
                          )}
                          {stage.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="rounded-xl border border-border bg-background p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-foreground">Hindi Transcript</p>
                    <Badge variant="secondary" className="font-normal text-[11px]">
                      {TEACHER_LANGUAGE}
                    </Badge>
                  </div>
                  {isTeacherTextVisible ? (
                    <p className="text-sm leading-relaxed text-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                      “{audio.teacherText}”
                    </p>
                  ) : audio.phase === "transcribing" ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 animate-pulse text-primary" />
                      Transcribing Hindi speech…
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Waiting for teacher&apos;s voice input…</p>
                  )}
                </div>

                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
                  <p className="text-xs font-semibold text-foreground mb-2">Santali Translation · {studentLanguage}</p>
                  {isStudentTextVisible ? (
                    <p className="text-sm leading-relaxed text-primary animate-in fade-in slide-in-from-bottom-1 duration-300">
                      “{audio.studentText}”
                    </p>
                  ) : audio.phase === "translating" ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 animate-pulse text-primary" />
                      Translating to Santali…
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Santali translation will appear here in real time.</p>
                  )}
                </div>

                {!micMuted && audio.latencyMs !== null && (
                  <div
                    className={cn(
                      "rounded-lg border px-3 py-2 space-y-1 text-xs",
                      audio.isLatencyHigh
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-border bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span>STT latency</span>
                      <span className="font-medium tabular-nums">
                        {audio.sttLatencyMs !== null ? `${(audio.sttLatencyMs / 1000).toFixed(1)}s` : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Translation latency</span>
                      <span className="font-medium tabular-nums">
                        {audio.translationLatencyMs !== null
                          ? `${(audio.translationLatencyMs / 1000).toFixed(1)}s`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-current/10 font-medium">
                      <span>{audio.isLatencyHigh ? "⚠️ Total" : "⚡ Total"}</span>
                      <span className="tabular-nums">{(audio.latencyMs / 1000).toFixed(1)}s</span>
                    </div>
                  </div>
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
          onClick={myRole === "student" ? handleLeaveClass : handleEndClass}
          aria-label={myRole === "student" ? "Leave Class" : "End Class"}
          className="flex h-11 items-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors"
        >
          <PhoneOff className="h-4 w-4" />
          {myRole === "student" ? "Leave Class" : "End Class"}
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
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <div className="h-full flex flex-col overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
      <div className="shrink-0 flex items-start justify-between gap-3 flex-wrap mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Video className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-foreground leading-tight">Start a Live Class</h1>
            <p className="text-sm text-muted-foreground leading-tight">
              {TEACHER_LANGUAGE} → {studentLanguage}, translated live for your students
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 shrink-0">
              <History className="h-3.5 w-3.5" />
              Recent Classes
              {classHistory.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 text-[10px] px-1.5">
                  {classHistory.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Recent Classes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {classHistory.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                Class history will appear here after your first session.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1 py-1">
                {classHistory.slice(0, 20).map((session) => (
                  <div key={session.session_id} className="flex items-center justify-between text-sm px-2 py-1.5">
                    <span className="text-muted-foreground text-xs">
                      {new Date(session.created_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <Badge variant={session.status === "active" ? "default" : "secondary"} className="text-[11px]">
                      {session.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {sessionError && (
        <div className="shrink-0 mb-4 mx-auto w-full max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {sessionError}
        </div>
      )}

      {/* Merged Create/Join card — one sliding toggle switches the whole
          form instead of two separate cards competing for space. */}
      <div className="flex-1 flex items-start justify-center">
        <div className="w-full max-w-md rounded-2xl border-2 border-primary/20 bg-card p-5 sm:p-6">
          <div className="relative grid grid-cols-2 rounded-full bg-muted p-1 mb-5">
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-sm transition-transform duration-300 ease-out",
                mode === "join" && "translate-x-full"
              )}
            />
            <button
              type="button"
              onClick={() => setMode("create")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors",
                mode === "create" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Video className="h-3.5 w-3.5" /> Create
            </button>
            <button
              type="button"
              onClick={() => setMode("join")}
              className={cn(
                "relative z-10 flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors",
                mode === "join" ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Smartphone className="h-3.5 w-3.5" /> Join
            </button>
          </div>

          {mode === "create" ? (
            <div key="create" className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <Label htmlFor="class-name" className="text-xs font-medium">
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
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <Label className="text-xs font-medium">Grade</Label>
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
                  <Label className="text-xs font-medium">Subject</Label>
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
                <Label className="text-xs font-medium">Student Language</Label>
                <Select value={studentLanguage} onValueChange={setStudentLanguage} disabled={!!classroom}>
                  <SelectTrigger className="w-full mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ho">Ho</SelectItem>
                    <SelectItem value="Mundari">Mundari</SelectItem>
                    <SelectItem value="Santhali">Santhali</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground">What happens when you create it</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Your mic and camera turn on instantly</li>
                  <li>Speech is translated live for students</li>
                  <li>The class runs for 60 minutes</li>
                </ul>
              </div>

              <Button onClick={onCreateClass} disabled={starting} size="lg" className="w-full h-11 gap-2 font-semibold">
                {starting ? "Starting…" : "Create Class"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Your microphone and camera start automatically.
              </p>
            </div>
          ) : (
            <div key="join" className="space-y-3.5 animate-in fade-in duration-200">
              <div>
                <Label className="text-xs font-medium">Class Code</Label>
                <Input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="e.g. 8MPRSW"
                  className="mt-1 uppercase tracking-wide"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Your Name</Label>
                <Input
                  value={studentName}
                  onChange={(event) => setStudentName(event.target.value)}
                  placeholder="Only used when joining"
                  className="mt-1"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground">How joining works</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Get the code from whoever started the class</li>
                  <li>You&apos;ll hear live translated audio instantly</li>
                  <li>Handy for testing two-way voice without a phone</li>
                </ul>
              </div>

              <Button onClick={onJoinClass} disabled={joiningClass || !joinCode} size="lg" className="w-full h-11 gap-2 font-semibold">
                {joiningClass ? "Joining…" : "Join Class"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Or enter this same code in the Android app once a class is live.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
