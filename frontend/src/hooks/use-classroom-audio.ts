"use client";

/**
 * AI audio translation pipeline — real microphone capture, chunked into
 * short segments and streamed over the existing `/ws/classroom/{id}`
 * WebSocket (see backend/app/api/websocket/classroom.py, unchanged).
 *
 * Deliberately independent of use-classroom-video.ts (video's own capture
 * is always audio:false, so there's no overlap there). It CAN share its
 * mic stream with use-classroom-call.ts's raw-call pipeline though — pass
 * one already-acquired MediaStream into both hooks' `start()` (see
 * live-classroom.tsx) rather than letting each open its own
 * `getUserMedia({ audio: true })`. Two independent concurrent mic captures
 * each run their own echo-cancellation/noise-suppression/AGC instance
 * fighting over the same physical microphone, which is a real, audible
 * cause of choppy/degraded audio — sharing one stream (each consumer reads
 * the same track independently; that's standard and well-supported) avoids
 * it entirely while keeping the pipelines as independently
 * start/stop/mute-able as before.
 *
 * Two-way: this hook always connects as role="teacher". The backend
 * broadcasts every event to both the teacher and student connections
 * attached to the same session_id (see the websocket handler's docstring),
 * so this hook receives events for BOTH directions - its own outgoing
 * Hindi speech (direction "teacher_to_student") AND the student's incoming
 * speech, translated to Hindi (direction "student_to_teacher"). Audio is
 * only auto-played here when this client is the *listener* for that
 * direction (student_to_teacher) - the teacher_to_student audio is meant
 * for the student's device, not this browser tab.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectClassroomSocket,
  audioEventToObjectUrl,
  type ClassroomEvent,
  type ClassroomSocket,
} from "@/lib/classroom-socket";

export type AudioPhase = "idle" | "listening" | "transcribing" | "translating" | "delivered";
export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface AudioHistoryItem {
  direction: "teacher_to_student" | "student_to_teacher";
  teacherText: string;
  studentText: string;
  latencyMs: number;
  time: string;
}

const MY_ROLE = "teacher" as const;

const SEGMENT_MS = 3500;
const RECONNECT_DELAY_MS = 2000;
const HOLD_AFTER_DELIVERED_MS = 2600;
const LATENCY_WARNING_MS = 3000;

const CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  return CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "audio/webm";
}

export function useClassroomAudio() {
  const [phase, setPhase] = useState<AudioPhase>("idle");
  const [wsStatus, setWsStatus] = useState<WsStatus>("disconnected");
  const [muted, setMuted] = useState(false);
  // Hindi-side text (teacher's own words, or the Hindi translation of the student's words).
  const [teacherText, setTeacherText] = useState("");
  // Student-language-side text (translation of the teacher's words, or the student's own words).
  const [studentText, setStudentText] = useState("");
  const [lastDirection, setLastDirection] = useState<"teacher_to_student" | "student_to_teacher" | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  // Per-stage breakdown of latencyMs, from the same "latency" event — each
  // is that stage's own measured duration (not cumulative), never fabricated.
  const [sttLatencyMs, setSttLatencyMs] = useState<number | null>(null);
  const [translationLatencyMs, setTranslationLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);

  const listeningRef = useRef(false);
  const mutedRef = useRef(false);
  const socketRef = useRef<ClassroomSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  // Whether THIS hook opened micStreamRef itself (and must stop it) vs. was
  // handed an already-acquired shared stream (owned/stopped by the caller).
  const ownsMicStreamRef = useRef(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<Record<string, unknown> | null>(null);
  const sessionRef = useRef<{ sessionId: string; source: string; target: string } | null>(null);
  const pendingRef = useRef<{ teacherText: string; studentText: string; direction: "teacher_to_student" | "student_to_teacher" } | null>(null);
  const mimeTypeRef = useRef("audio/webm");

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  const playTranslatedAudio = useCallback((event: ClassroomEvent) => {
    const url = audioEventToObjectUrl(event);
    if (!url) return;
    if (!audioPlayerRef.current) {
      audioPlayerRef.current = new Audio();
    }
    const player = audioPlayerRef.current;
    player.src = url;
    player.play().catch(() => {
      // Autoplay can be blocked before any user gesture; the teacher has
      // already clicked "Start Live Class" by this point in practice.
    });
    player.onended = () => URL.revokeObjectURL(url);
  }, []);

  // Self-recursive (each segment's onstop starts the next segment), so it's
  // called through a ref rather than by name — avoids relying on the
  // useCallback binding still being the current one by the time an async
  // MediaRecorder event fires.
  const startNewRecorderSegmentRef = useRef<() => void>(() => {});
  const startNewRecorderSegment = useCallback(() => {
    const stream = micStreamRef.current;
    if (!stream || !listeningRef.current) return;

    const recorder = new MediaRecorder(stream, { mimeType: mimeTypeRef.current });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      if (!mutedRef.current && chunks.length > 0 && socketRef.current) {
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeTypeRef.current });
        socketRef.current.sendAudioSegment(blob);
        setPhase("transcribing");
      }
      if (listeningRef.current) startNewRecorderSegmentRef.current();
    };
    recorder.start();
    recorderRef.current = recorder;
  }, []);
  useEffect(() => {
    startNewRecorderSegmentRef.current = startNewRecorderSegment;
  }, [startNewRecorderSegment]);

  const handleEvent = useCallback(
    (event: ClassroomEvent) => {
      switch (event.type) {
        case "config_ack":
          setWsStatus("connected");
          break;
        case "transcript": {
          const direction = event.direction ?? "teacher_to_student";
          const text = event.text ?? "";
          // The transcript is always in the speaker's own language: show it
          // on the Hindi side if the teacher spoke, the student-language
          // side if the student spoke. The *other* side fills in once the
          // matching "translation" event arrives.
          if (direction === "teacher_to_student") {
            setTeacherText(text);
            pendingRef.current = { teacherText: text, studentText: "", direction };
          } else {
            setStudentText(text);
            pendingRef.current = { teacherText: "", studentText: text, direction };
          }
          setLastDirection(direction);
          setErrorMessage(null);
          // Transcript back = STT stage is done; now translating.
          setPhase("translating");
          break;
        }
        case "translation": {
          const direction = event.direction ?? "teacher_to_student";
          const text = event.text ?? "";
          if (direction === "teacher_to_student") {
            setStudentText(text);
            if (pendingRef.current) pendingRef.current.studentText = text;
          } else {
            setTeacherText(text);
            if (pendingRef.current) pendingRef.current.teacherText = text;
          }
          break;
        }
        case "audio":
          // Only play audio for the direction where THIS client is the
          // listener, not the speaker — teacher_to_student audio is for the
          // student's device; playing it here too would be confusing noise.
          if (event.speaker && event.speaker !== MY_ROLE) {
            playTranslatedAudio(event);
          }
          setPhase("delivered");
          break;
        case "latency": {
          const direction = event.direction ?? lastDirection ?? "teacher_to_student";
          const pending = pendingRef.current;
          setLatencyMs(event.total_ms ?? null);
          setSttLatencyMs(event.stt_ms ?? null);
          setTranslationLatencyMs(event.translation_ms ?? null);
          setHistory((h) => [
            {
              direction,
              teacherText: pending?.teacherText ?? "",
              studentText: pending?.studentText ?? "",
              latencyMs: event.total_ms ?? 0,
              time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            },
            ...h,
          ]);
          pendingRef.current = null;
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            if (listeningRef.current) setPhase("listening");
          }, HOLD_AFTER_DELIVERED_MS);
          break;
        }
        case "error":
          setErrorMessage(event.message ?? "Translation temporarily unavailable");
          setPhase("listening");
          break;
      }
    },
    [playTranslatedAudio, lastDirection]
  );

  // Self-recursive on reconnect, for the same reason as
  // startNewRecorderSegment above — called through a ref, not by name.
  const connectSocketRef = useRef<(sessionId: string, source: string, target: string) => void>(
    () => {}
  );
  const connectSocket = useCallback(
    (sessionId: string, source: string, target: string) => {
      setWsStatus("connecting");
      const socket = connectClassroomSocket(sessionId, {
        onEvent: handleEvent,
        onOpen: () => {
          socket.sendConfig(MY_ROLE, source, target, mimeTypeRef.current, contextRef.current ?? undefined);
        },
        onClose: () => {
          socketRef.current = null;
          if (listeningRef.current) {
            setWsStatus("reconnecting");
            reconnectTimerRef.current = setTimeout(() => {
              if (listeningRef.current && sessionRef.current) {
                connectSocketRef.current(
                  sessionRef.current.sessionId,
                  sessionRef.current.source,
                  sessionRef.current.target
                );
              }
            }, RECONNECT_DELAY_MS);
          } else {
            setWsStatus("disconnected");
          }
        },
        onSocketError: () => {
          setErrorMessage("Translation connection interrupted — reconnecting…");
        },
      });
      socketRef.current = socket;
    },
    [handleEvent]
  );
  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  const start = useCallback(
    async (
      sessionId: string,
      sourceLanguage: string,
      targetLanguage: string,
      lessonContext?: Record<string, unknown>,
      sharedStream?: MediaStream
    ) => {
      sessionRef.current = { sessionId, source: sourceLanguage, target: targetLanguage };
      contextRef.current = lessonContext ?? null;
      listeningRef.current = true;
      setPhase("listening");
      setErrorMessage(null);
      setHistory([]);

      mimeTypeRef.current = pickSupportedMimeType();

      if (sharedStream) {
        micStreamRef.current = sharedStream;
        ownsMicStreamRef.current = false;
      } else {
        try {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          });
          ownsMicStreamRef.current = true;
        } catch {
          setErrorMessage("Microphone permission denied — AI translation cannot start.");
          listeningRef.current = false;
          setPhase("idle");
          return;
        }
      }

      connectSocket(sessionId, sourceLanguage, targetLanguage);
      startNewRecorderSegment();
      segmentTimerRef.current = setInterval(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, SEGMENT_MS);
    },
    [connectSocket, startNewRecorderSegment]
  );

  const stop = useCallback(() => {
    listeningRef.current = false;
    sessionRef.current = null;
    contextRef.current = null;

    if (segmentTimerRef.current) clearInterval(segmentTimerRef.current);
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (ownsMicStreamRef.current) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    }
    micStreamRef.current = null;

    socketRef.current?.close();
    socketRef.current = null;

    setPhase("idle");
    setWsStatus("disconnected");
    setTeacherText("");
    setStudentText("");
    setLatencyMs(null);
    setSttLatencyMs(null);
    setTranslationLatencyMs(null);
  }, []);

  useEffect(() => stop, [stop]); // cleanup on unmount

  return {
    phase,
    wsStatus,
    muted,
    setMuted,
    teacherText,
    studentText,
    lastDirection,
    latencyMs,
    sttLatencyMs,
    translationLatencyMs,
    isLatencyHigh: latencyMs !== null && latencyMs > LATENCY_WARNING_MS,
    errorMessage,
    history,
    start,
    stop,
  };
}
