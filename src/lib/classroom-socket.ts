/**
 * Thin wrapper around the `/ws/classroom/{session_id}` real-time translation
 * socket. See backend/README.md "WebSocket protocol" for the wire format.
 */

import { API_BASE_URL } from "@/lib/api";

export interface ClassroomEvent {
  type: "transcript" | "translation" | "audio" | "latency" | "error" | "config_ack";
  text?: string;
  language?: string;
  source_language?: string;
  target_language?: string;
  format?: string;
  data?: string;
  total_ms?: number;
  message?: string;
}

export interface ClassroomSocketHandlers {
  onEvent: (event: ClassroomEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onSocketError?: () => void;
}

export interface ClassroomSocket {
  sendConfig: (sourceLanguage: string, targetLanguage: string) => void;
  sendAudioSegment: (audio: Blob | ArrayBuffer) => void;
  close: () => void;
}

function wsBaseUrl(): string {
  return API_BASE_URL.replace(/^http/, "ws");
}

export function connectClassroomSocket(
  sessionId: string,
  handlers: ClassroomSocketHandlers
): ClassroomSocket {
  const socket = new WebSocket(`${wsBaseUrl()}/ws/classroom/${sessionId}`);

  socket.onopen = () => handlers.onOpen?.();
  socket.onclose = () => handlers.onClose?.();
  socket.onerror = () => handlers.onSocketError?.();
  socket.onmessage = (event) => {
    try {
      handlers.onEvent(JSON.parse(event.data));
    } catch {
      // ignore malformed frames
    }
  };

  return {
    sendConfig(sourceLanguage, targetLanguage) {
      if (socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({ type: "config", source_language: sourceLanguage, target_language: targetLanguage })
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

/** Decode a base64 "audio" event payload into a playable object URL. */
export function audioEventToObjectUrl(event: ClassroomEvent): string | null {
  if (event.type !== "audio" || !event.data) return null;
  const binary = atob(event.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: event.format || "audio/wav" });
  return URL.createObjectURL(blob);
}
