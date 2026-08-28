"use client";

/**
 * Raw two-way audio "call" pipeline — NO transcription, NO translation, NO
 * Sarvam AI involved at all. Mic audio is captured as raw PCM16 mono 16kHz,
 * streamed over a dedicated connection to the SAME existing
 * `/ws/classroom/{id}` WebSocket route (no new route — the registry keys by
 * connection identity, not role, so this coexists safely alongside the AI
 * pipeline's own connection; see backend/app/api/websocket/classroom.py's
 * "Raw call mode"). Whatever the other side streams back is played through
 * a jitter-buffered Web Audio scheduler so it sounds like a live call
 * instead of a chunky, delayed loop.
 *
 * Deliberately independent of use-classroom-audio.ts (AI translation) and
 * use-classroom-video.ts (LiveKit video) — a third pipeline you can start
 * or stop on its own. Useful right now specifically because it needs no
 * Sarvam/LiveKit credentials at all — it's a pure byte relay through the
 * backend that's already deployed.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { connectClassroomSocket, type ClassroomSocket, type ClassroomRole } from "@/lib/classroom-socket";

export type CallStatus = "idle" | "connecting" | "live" | "reconnecting" | "error";

const SEND_SAMPLE_RATE = 16000;
const CHUNK_SAMPLES = 4096; // ~256ms at 16kHz — small enough to feel live
const RECONNECT_DELAY_MS = 2000;
const SPEAKING_INDICATOR_HOLD_MS = 900;

/** Linear-interpolation downsampler: the mic's native AudioContext sample
 * rate (commonly 48000Hz) down to the fixed 16kHz wire format both sides
 * agree on. */
function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === SEND_SAMPLE_RATE) return input;
  const ratio = inputRate / SEND_SAMPLE_RATE;
  const outLength = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const srcIndex = i * ratio;
    const i0 = Math.floor(srcIndex);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = srcIndex - i0;
    output[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return output;
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

type AudioContextCtor = typeof AudioContext;

export function useClassroomCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [remoteSpeaking, setRemoteSpeaking] = useState<ClassroomRole | null>(null);

  const activeRef = useRef(false);
  const socketRef = useRef<ClassroomSocket | null>(null);
  const sessionRef = useRef<{ sessionId: string; role: ClassroomRole } | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const micStreamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);

  const playContextRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef(0);
  const remoteSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playRawChunk = useCallback((data: ArrayBuffer) => {
    if (data.byteLength < 3) return; // need at least the speaker byte + 1 sample
    const speakerByte = new Uint8Array(data, 0, 1)[0];
    const speaker: ClassroomRole = speakerByte === 0 ? "teacher" : "student";
    const pcm = new Int16Array(data.slice(1));

    const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext);
    if (!playContextRef.current) {
      playContextRef.current = new Ctor();
    }
    const ctx = playContextRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const audioBuffer = ctx.createBuffer(1, pcm.length, SEND_SAMPLE_RATE);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Jitter buffer: schedule this chunk right after the previous one ends
    // (never earlier than "now"), so chunks play back-to-back with no gaps
    // or overlaps even though they arrive over the network at slightly
    // uneven intervals — this is what makes it sound continuous, like a
    // call, instead of a series of separate clips.
    const startAt = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startAt);
    nextPlayTimeRef.current = startAt + audioBuffer.duration;

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

  const start = useCallback(
    async (sessionId: string, role: ClassroomRole = "teacher") => {
      sessionRef.current = { sessionId, role };
      activeRef.current = true;
      setErrorMessage(null);
      nextPlayTimeRef.current = 0;

      try {
        micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setErrorMessage("Microphone permission denied — live call audio cannot start.");
        activeRef.current = false;
        setStatus("error");
        return;
      }

      const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext: AudioContextCtor }).webkitAudioContext);
      const captureContext = new Ctor();
      captureContextRef.current = captureContext;

      const source = captureContext.createMediaStreamSource(micStreamRef.current);
      sourceNodeRef.current = source;

      // ScriptProcessorNode is deprecated but universally supported and
      // simplest for a single self-contained hook (no separate AudioWorklet
      // module file to load). It only fires reliably once the graph reaches
      // a destination, so it's routed through a silent gain node — that
      // keeps it running without playing the local mic back to its own
      // speakers (which would otherwise be an instant, jarring echo).
      const processor = captureContext.createScriptProcessor(CHUNK_SAMPLES, 1, 1);
      processorRef.current = processor;
      const silentGain = captureContext.createGain();
      silentGain.gain.value = 0;
      silentGainRef.current = silentGain;

      processor.onaudioprocess = (e) => {
        if (!activeRef.current || !socketRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(input, captureContext.sampleRate);
        socketRef.current.sendAudioSegment(floatTo16BitPCM(downsampled));
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(captureContext.destination);

      connectSocket();
    },
    [connectSocket]
  );

  const stop = useCallback(() => {
    activeRef.current = false;
    sessionRef.current = null;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (remoteSpeakingTimeoutRef.current) clearTimeout(remoteSpeakingTimeoutRef.current);

    processorRef.current?.disconnect();
    processorRef.current = null;
    silentGainRef.current?.disconnect();
    silentGainRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    captureContextRef.current?.close().catch(() => {});
    captureContextRef.current = null;

    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;

    socketRef.current?.close();
    socketRef.current = null;

    setStatus("idle");
    setRemoteSpeaking(null);
  }, []);

  useEffect(() => stop, [stop]); // cleanup on unmount

  return { status, errorMessage, remoteSpeaking, start, stop };
}
