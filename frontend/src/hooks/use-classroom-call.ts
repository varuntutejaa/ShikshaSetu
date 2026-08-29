"use client";

/**
 * Raw two-way audio "call" pipeline — NO transcription, NO translation, NO
 * Sarvam AI involved at all. Mic audio is captured via an AudioWorklet
 * (runs on the dedicated audio thread, not main JS — the old
 * ScriptProcessorNode-based version could glitch/drop samples under main-
 * thread load, a real cause of choppy audio) inside an AudioContext created
 * directly at the wire sample rate (16kHz), so the browser's own audio
 * pipeline does the mic-rate -> 16kHz resampling with a proper anti-
 * aliasing filter — no hand-rolled resampling on the JS side, which used to
 * risk aliasing artifacts. Streamed over a dedicated connection to the SAME
 * existing `/ws/classroom/{id}` WebSocket route (no new route — the
 * registry keys by connection identity, not role; see
 * backend/app/api/websocket/classroom.py's "Raw call mode"). Playback uses
 * a jitter-buffered Web Audio scheduler so it sounds like a live call
 * instead of a chunky, delayed loop.
 *
 * Deliberately independent of use-classroom-audio.ts (AI translation) and
 * use-classroom-video.ts (LiveKit video) — a third pipeline you can start
 * or stop on its own. Can share its mic stream with use-classroom-audio.ts
 * via `start`'s sharedStream param — see that hook's docstring for why.
 *
 * `muted` genuinely silences this pipeline: the worklet still captures
 * (so unmuting is instant, no re-negotiation), it just stops sending
 * chunks to the socket while muted — this is the audio the teacher and
 * student actually hear, so this is what the UI's Mute button controls.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectClassroomSocket, type ClassroomSocket, type ClassroomRole } from "@/lib/classroom-socket";

export type CallStatus = "idle" | "connecting" | "live" | "reconnecting" | "error";

const SEND_SAMPLE_RATE = 16000;
const RECONNECT_DELAY_MS = 2000;
const SPEAKING_INDICATOR_HOLD_MS = 900;

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext;
}

function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export function useClassroomCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState<ClassroomRole | null>(null);
  const [muted, setMuted] = useState(false);

  const activeRef = useRef(false);
  const mutedRef = useRef(false);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  const socketRef = useRef<ClassroomSocket | null>(null);
  const sessionRef = useRef<{ sessionId: string; role: ClassroomRole } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const ownsMicStreamRef = useRef(true);
  const captureContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);

  const playContextRef = useRef<AudioContext | null>(null);
  // One playback timeline PER SENDER (keyed by the 2-byte peer id the
  // backend now tags every raw frame with — see classroom.py's "Raw call
  // mode"), not one shared timeline for the whole call. With only one
  // remote peer these are equivalent, but the moment a second student
  // joins, both send continuous PCM chunks (a worklet posts chunks
  // whenever unmuted, not just while actually talking) — feeding two
  // independent streams into one shared `nextPlayTime` serialized them
  // into a single queue, which is what "echoes badly, repeats" actually
  // was: peer B's chunks scheduled after whatever backlog peer A had
  // already queued, instead of playing concurrently. Web Audio mixes
  // multiple BufferSources connected to the same destination automatically
  // — all that was ever needed was to stop sharing one clock between them.
  const nextPlayTimeByPeerRef = useRef<Map<number, number>>(new Map());
  const remoteSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playRawChunk = useCallback((data: ArrayBuffer) => {
    if (data.byteLength < 4) return;
    const header = new Uint8Array(data, 0, 3);
    const speakerByte = header[0];
    const peerId = (header[1] << 8) | header[2];
    const speaker: ClassroomRole = speakerByte === 0 ? "teacher" : "student";
    const pcm = new Int16Array(data.slice(3));

    if (!playContextRef.current) {
      playContextRef.current = new (getAudioContextCtor())({ sampleRate: SEND_SAMPLE_RATE });
    }
    const ctx = playContextRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const audioBuffer = ctx.createBuffer(1, pcm.length, SEND_SAMPLE_RATE);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Jitter buffer, per sender: schedule this chunk right after that same
    // sender's previous chunk ends (never earlier than "now"), so each
    // peer's own audio plays back-to-back with no gaps — while multiple
    // peers' streams overlap freely and get mixed by the destination, the
    // way an actual multi-party call sounds. If one peer stalled, their
    // own next-play-time is in the past and correctly snaps back to "now"
    // instead of accumulating unbounded lag.
    const nextPlayTimeForPeer = nextPlayTimeByPeerRef.current.get(peerId) ?? 0;
    const startAt = Math.max(ctx.currentTime, nextPlayTimeForPeer);
    source.start(startAt);
    nextPlayTimeByPeerRef.current.set(peerId, startAt + audioBuffer.duration);

    setRemoteSpeaking(speaker);
    if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);
    remoteSpeakingTimeoutRef.current = setTimeout(() => setRemoteSpeaking(null), SPEAKING_INDICATOR_HOLD_MS);
  }, []);

  const connectSocketRef = useRef<() => void>(() => {});
  const connectSocket = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    setStatus("connecting");
    const socket = connectClassroomSocket(session.sessionId, {
      onEvent: (event) => {
        if (event.type === "config_ack") setStatus("live");
        if (event.type === "error") setErrorMessage(event.message ?? "Call error");
      },
      onRawAudio: playRawChunk,
      onOpen: () => {
        socket.sendConfig(session.role, "", "", "audio/raw-pcm-16k", undefined, true);
      },
      onClose: () => {
        socketRef.current = null;
        if (activeRef.current) {
          setStatus("reconnecting");
          reconnectTimerRef.current = setTimeout(() => connectSocketRef.current(), RECONNECT_DELAY_MS);
        } else {
          setStatus("idle");
        }
      },
      onSocketError: () => setErrorMessage("Call connection interrupted — reconnecting…"),
    });
    socketRef.current = socket;
  }, [playRawChunk]);
  useEffect(() => {
    connectSocketRef.current = connectSocket;
  }, [connectSocket]);

  const stop = useCallback(() => {
    activeRef.current = false;
    sessionRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);

    workletNodeRef.current?.port.close();
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    captureContextRef.current?.close().catch(() => {});
    captureContextRef.current = null;

    if (ownsMicStreamRef.current) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
    }
    micStreamRef.current = null;

    socketRef.current?.close();
    socketRef.current = null;

    setStatus("idle");
    setRemoteSpeaking(null);
  }, []);

  const start = useCallback(
    async (sessionId: string, role: ClassroomRole = "teacher", sharedStream?: MediaStream) => {
      // Idempotent: if this hook is already mid-call (e.g. a duplicate
      // invocation from a re-clicked Join button, a component re-render
      // race, or any other re-entry path), tear down the previous
      // connection/capture/socket cleanly first instead of leaking it —
      // a leaked prior connection is exactly what used to keep sending a
      // second, never-torn-down audio stream into the same session.
      if (activeRef.current) stop();

      sessionRef.current = { sessionId, role };
      activeRef.current = true;
      setErrorMessage(null);
      nextPlayTimeByPeerRef.current.clear();

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
          setErrorMessage("Microphone permission denied — live call audio cannot start.");
          activeRef.current = false;
          setStatus("error");
          return;
        }
      }

      try {
        // Creating the AudioContext directly at the wire sample rate means
        // the browser's own (properly band-limited) resampler handles
        // mic-native-rate -> 16kHz, instead of a hand-rolled one that risks
        // aliasing artifacts.
        const captureContext = new (getAudioContextCtor())({ sampleRate: SEND_SAMPLE_RATE });
        captureContextRef.current = captureContext;

        await captureContext.audioWorklet.addModule("/audio/pcm-capture-worklet.js");

        const source = captureContext.createMediaStreamSource(micStreamRef.current);
        sourceNodeRef.current = source;

        const worklet = new AudioWorkletNode(captureContext, "pcm-capture-processor");
        workletNodeRef.current = worklet;
        worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
          if (!activeRef.current || !socketRef.current || mutedRef.current) return;
          socketRef.current.sendAudioSegment(floatTo16BitPCM(e.data));
        };

        // Route through a silent gain node rather than straight to
        // destination — keeps the graph "live" on browsers that expect a
        // path to the output, without playing the local mic back to its
        // own speakers (which would otherwise be an instant, jarring echo).
        const silentGain = captureContext.createGain();
        silentGain.gain.value = 0;
        silentGainRef.current = silentGain;

        source.connect(worklet);
        worklet.connect(silentGain);
        silentGain.connect(captureContext.destination);
      } catch {
        setErrorMessage("Could not start live call audio on this browser.");
        activeRef.current = false;
        setStatus("error");
        if (ownsMicStreamRef.current) micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        return;
      }

      connectSocket();
    },
    [connectSocket, stop]
  );

  useEffect(() => stop, [stop]); // cleanup on unmount

  return { status, errorMessage, remoteSpeaking, muted, setMuted, start, stop };
}
