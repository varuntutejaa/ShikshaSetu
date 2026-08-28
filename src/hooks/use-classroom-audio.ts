"use client";

/**
 * AI audio translation pipeline — real microphone capture, chunked into
 * short segments and streamed over the existing `/ws/classroom/{id}`
 * WebSocket (see backend/app/api/websocket/classroom.py, unchanged).
 *
 * Deliberately independent of use-classroom-video.ts: this hook opens its
 * OWN `getUserMedia({ audio: true })` capture (a second, separate mic
 * stream from whatever the video pipeline publishes), so the two pipelines
 * can fail, reconnect, or be muted/toggled without affecting each other —
 * per the "two independently recoverable pipelines" requirement.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  connectClassroomSocket,
  audioEventToObjectUrl,
  type ClassroomEvent,
  type ClassroomSocket,
} from "@/lib/classroom-socket";

export type AudioPhase = "idle" | "listening" | "translating" | "delivered";
export type WsStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

export interface AudioHistoryItem {
  teacherText: string;
  studentText: string;
  latencyMs: number;
  time: string;
}

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
  const [teacherText, setTeacherText] = useState("");
  const [studentText, setStudentText] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioHistoryItem[]>([]);

  const listeningRef = useRef(false);
  const mutedRef = useRef(false);
  const socketRef = useRef<ClassroomSocket | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const segmentTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<Record<string, unknown> | null>(null);
  const sessionRef = useRef<{ sessionId: string; source: string; target: string } | null>(null);
  const lastTeacherTextRef = useRef("");
  const lastStudentTextRef = useRef("");
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
        setPhase("translating");
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
        case "transcript":
          lastTeacherTextRef.current = event.text ?? "";
          setTeacherText(event.text ?? "");
          setErrorMessage(null);
          break;
        case "translation":
          lastStudentTextRef.current = event.text ?? "";
          setStudentText(event.text ?? "");
          break;
        case "audio":
          playTranslatedAudio(event);
          setPhase("delivered");
          break;
        case "latency":
          setLatencyMs(event.total_ms ?? null);
          setHistory((h) => [
            {
              teacherText: lastTeacherTextRef.current,
              studentText: lastStudentTextRef.current,
              latencyMs: event.total_ms ?? 0,
              time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
            },
            ...h,
          ]);
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = setTimeout(() => {
            if (listeningRef.current) setPhase("listening");
          }, HOLD_AFTER_DELIVERED_MS);
          break;
        case "error":
          setErrorMessage(event.message ?? "Translation temporarily unavailable");
          setPhase("listening");
          break;
      }
    },
    [playTranslatedAudio]
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
          socket.sendConfig(source, target, mimeTypeRef.current, contextRef.current ?? undefined);
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
      lessonContext?: Record<string, unknown>
    ) => {
      sessionRef.current = { sessionId, source: sourceLanguage, target: targetLanguage };
      contextRef.current = lessonContext ?? null;
      listeningRef.current = true;
      setPhase("listening");
      setErrorMessage(null);
      setHistory([]);

      mimeTypeRef.current = pickSupportedMimeType();

      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setErrorMessage("Microphone permission denied — AI translation cannot start.");
        listeningRef.current = false;
        setPhase("idle");
        return;
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

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    socketRef.current?.close();
    socketRef.current = null;

    setPhase("idle");
    setWsStatus("disconnected");
    setTeacherText("");
    setStudentText("");
    setLatencyMs(null);
  }, []);

  useEffect(() => stop, [stop]); // cleanup on unmount

  return {
    phase,
    wsStatus,
    muted,
    setMuted,
    teacherText,
    studentText,
    latencyMs,
    isLatencyHigh: latencyMs !== null && latencyMs > LATENCY_WARNING_MS,
    errorMessage,
    history,
    start,
    stop,
    setDirection(sourceLanguage: string, targetLanguage: string, lessonContext?: Record<string, unknown>) {
      if (!sessionRef.current || !socketRef.current) return;
      sessionRef.current = { ...sessionRef.current, source: sourceLanguage, target: targetLanguage };
      contextRef.current = lessonContext ?? contextRef.current;
      socketRef.current.sendConfig(sourceLanguage, targetLanguage, mimeTypeRef.current, contextRef.current ?? undefined);
    },
  };
}
