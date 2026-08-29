/**
 * Thin wrapper around the `/ws/classroom/{session_id}` real-time translation
 * socket. See backend/README.md "WebSocket protocol" for the wire format.
 */

import { API_BASE_URL } from "@/lib/api";
import type { ClassroomParticipant } from "@/lib/api";

export type ClassroomRole = "teacher" | "student";
export type ClassroomDirection = "teacher_to_student" | "student_to_teacher";

export interface ClassroomEvent {
  type: "transcript" | "translation" | "audio" | "latency" | "error" | "config_ack";
  text?: string;
  language?: string;
  source_language?: string;
  target_language?: string;
  format?: string;
  data?: string;
  total_ms?: number;
  /** Each stage's own duration (not cumulative) — present on "latency" events. */
  stt_ms?: number;
  translation_ms?: number;
  message?: string;
  context_used?: Record<string, unknown> | null;
  /** Who produced this segment - present on config_ack and every broadcast event. */
  role?: ClassroomRole;
  speaker?: ClassroomRole;
  /** teacher_to_student or student_to_teacher - lets a receiver tell which
   * panel/history row a broadcast event belongs to regardless of its own role. */
  direction?: ClassroomDirection;
}

export interface ClassroomSocketHandlers {
  onEvent: (event: ClassroomEvent) => void;
  /** Raw call mode only — see backend/app/api/websocket/classroom.py
   * "Raw call mode". Fired for every binary frame the server relays: one
   * leading speaker byte (0 = teacher, 1 = student) followed by the raw
   * PCM16 mono 16kHz audio bytes, untouched by any AI pipeline. */
  onRawAudio?: (data: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onSocketError?: () => void;
}

export interface ClassroomSocket {
  sendConfig: (
    role: ClassroomRole,
    sourceLanguage: string,
    targetLanguage: string,
    contentType?: string,
    lessonContext?: Record<string, unknown>,
    rawCall?: boolean
  ) => void;
  sendAudioSegment: (audio: Blob | ArrayBuffer) => void;
  close: () => void;
}

export type PresenceEvent =
  | { type: "presence_snapshot"; participants: ClassroomParticipant[] }
  | { type: "participant_joined" | "participant_left"; participant: ClassroomParticipant }
  | { type: "content_changed"; session_id: string; lesson_id: string | null; slide_index: number; offline_pack?: Record<string, unknown> | null }
  | { type: "pong" };

function wsBaseUrl(): string {
  return API_BASE_URL.replace(/^http/, "ws");
}

export function connectClassroomSocket(
  sessionId: string,
  handlers: ClassroomSocketHandlers
): ClassroomSocket {
  const socket = new WebSocket(`${wsBaseUrl()}/ws/classroom/${sessionId}`);
  // Binary frames arrive as ArrayBuffer (not Blob) so onRawAudio can read
  // the leading speaker byte synchronously without an extra await.
  socket.binaryType = "arraybuffer";

  socket.onopen = () => handlers.onOpen?.();
  socket.onclose = () => handlers.onClose?.();
  socket.onerror = () => handlers.onSocketError?.();
  socket.onmessage = (event) => {
    if (typeof event.data === "string") {
      try {
        handlers.onEvent(JSON.parse(event.data));
      } catch {
        // ignore malformed frames
      }
    } else if (event.data instanceof ArrayBuffer) {
      handlers.onRawAudio?.(event.data);
    }
  };

  return {
    sendConfig(role, sourceLanguage, targetLanguage, contentType, lessonContext, rawCall) {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: "config",
          role,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          ...(contentType ? { content_type: contentType } : {}),
          ...(lessonContext ? { lesson_context: lessonContext } : {}),
          ...(rawCall ? { raw_call: true } : {}),
        })
      );
    },
    sendAudioSegment(audio) {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(audio);
    },
    close() {
      socket.close();
    },
  };
}

export function connectClassroomPresenceSocket(
  sessionId: string,
  participant: { type: "teacher" | "student"; name: string; studentId?: string },
  handlers: { onEvent: (event: PresenceEvent) => void; onClose?: () => void; onSocketError?: () => void }
): WebSocket & { setContent?: (lessonId: string | null, slideIndex: number) => void } {
  const params = new URLSearchParams({ type: participant.type, name: participant.name });
  if (participant.studentId) params.set("student_id", participant.studentId);
  const socket = new WebSocket(`${wsBaseUrl()}/ws/classroom/${sessionId}/presence?${params}`);
  socket.onclose = () => handlers.onClose?.();
  socket.onerror = () => handlers.onSocketError?.();
  socket.onmessage = (event) => {
    try {
      handlers.onEvent(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };
  return Object.assign(socket, {
    setContent(lessonId: string | null, slideIndex: number) {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(JSON.stringify({ type: "set_content", lesson_id: lessonId, slide_index: slideIndex }));
    },
  });
}

/** Decode a base64 "audio" event payload into a playable object URL. */
export function audioEventToObjectUrl(event: ClassroomEvent): string | null {
  if (event.type !== "audio" || !event.data) return null;
  const binary = atob(event.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: event.format || "audio/wav" });
  return URL.createObjectURL(blob);
}
