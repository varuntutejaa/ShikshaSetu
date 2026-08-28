"use client";

/**
 * Teacher video pipeline — WebRTC via LiveKit, entirely separate from the
 * AI audio translation WebSocket (see use-classroom-audio.ts). This hook
 * never touches audio meant for translation; LiveKit publishes an ordinary
 * video-call track (camera + mic) so a viewer can see AND hear the teacher
 * normally, independent of whatever the AI pipeline is doing.
 *
 * `livekit-client` is dynamically imported inside start() — never at module
 * scope — since it touches browser-only APIs and must not be evaluated
 * during SSR.
 */

import { useCallback, useRef, useState } from "react";
import { getLiveKitToken, ApiError } from "@/lib/api";
import type { Room as LiveKitRoom, LocalParticipant } from "livekit-client";

export type VideoStatus = "idle" | "connecting" | "connected" | "unavailable";

export function useClassroomVideo() {
  const [status, setStatus] = useState<VideoStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  // Tracks whether *any* preview is currently attached — including the
  // local-only fallback used when LiveKit isn't configured/reachable, which
  // `status` alone doesn't capture (status stays "unavailable" there).
  const [hasPreview, setHasPreview] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const roomRef = useRef<LiveKitRoom | null>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  const attachPreviewStream = useCallback((stream: MediaStream) => {
    previewStreamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
    setHasPreview(true);
  }, []);

  const stop = useCallback(() => {
    roomRef.current?.disconnect();
    roomRef.current = null;
    previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    previewStreamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.removeAttribute("src");
    }
    setStatus("idle");
    setStatusMessage(null);
    setCameraOn(false);
    setMicOn(false);
    setHasPreview(false);
  }, []);

  const start = useCallback(
    async (sessionId: string) => {
      setStatus("connecting");
      setStatusMessage(null);

      // 1. LiveKit token — a plain fetch failure or an explicit
      // "not configured" response are both non-fatal: the AI audio pipeline
      // must keep working regardless (use-classroom-audio.ts is independent).
      let tokenResult: Awaited<ReturnType<typeof getLiveKitToken>> | null = null;
      try {
        tokenResult = await getLiveKitToken(sessionId, "teacher");
      } catch (err) {
        const message =
          err instanceof ApiError && err.code === "LIVEKIT_NOT_CONFIGURED"
            ? "Video not configured on this backend"
            : "Video connection unavailable";
        setStatus("unavailable");
        setStatusMessage(message);
        await fallbackToLocalPreviewOnly(attachPreviewStream);
        return;
      }

      // 2. Connect to the LiveKit room and publish camera + mic.
      try {
        const { Room, RoomEvent } = await import("livekit-client");
        const room = new Room();
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, () => {
          setStatus("unavailable");
          setStatusMessage("Video connection lost");
          setCameraOn(false);
          setMicOn(false);
          setHasPreview(false);
        });

        await room.connect(tokenResult.url, tokenResult.token);
        const local: LocalParticipant = room.localParticipant;

        await local.setCameraEnabled(true);
        await local.setMicrophoneEnabled(true);

        const videoPublication = local.videoTrackPublications.values().next().value;
        if (videoPublication?.videoTrack && videoRef.current) {
          videoPublication.videoTrack.attach(videoRef.current);
          setHasPreview(true);
        }

        setStatus("connected");
        setCameraOn(true);
        setMicOn(true);
      } catch {
        setStatus("unavailable");
        setStatusMessage("Video connection lost");
        roomRef.current?.disconnect();
        roomRef.current = null;
        await fallbackToLocalPreviewOnly(attachPreviewStream);
      }
    },
    [attachPreviewStream]
  );

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !cameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setCameraOn(next);
  }, [cameraOn]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !micOn;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  }, [micOn]);

  return { videoRef, status, statusMessage, cameraOn, micOn, hasPreview, start, stop, toggleCamera, toggleMic };
}

/** When LiveKit isn't reachable/configured, still show the teacher their own
 * camera locally (genuinely real — just not broadcast anywhere) rather than
 * a dead box, so "video not configured" reads as a backend/config state and
 * not "your camera is broken". */
async function fallbackToLocalPreviewOnly(
  attach: (stream: MediaStream) => void
): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    attach(stream);
  } catch {
    // Camera permission denied or unavailable — status/message already set
    // by the caller; nothing more to show.
  }
}
