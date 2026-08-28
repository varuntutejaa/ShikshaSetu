/**
 * Runs on the dedicated audio rendering thread (not the main JS thread),
 * so capture never glitches/drops samples under main-thread load — the
 * real weakness of the deprecated ScriptProcessorNode this replaces.
 * Buffers incoming Float32 samples and posts a chunk to the main thread
 * every CHUNK_SIZE samples. The AudioContext this runs in is created at
 * 16000Hz (see use-classroom-call.ts), so these samples are already at the
 * exact wire sample rate — no resampling needed on the JS side at all.
 */
const CHUNK_SIZE = 3200; // ~200ms at 16kHz

class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = new Float32Array(CHUNK_SIZE);
    this._writeIndex = 0;
  }

  process(inputs) {
    const input = inputs[0];
    const channel = input && input[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) {
        this._buffer[this._writeIndex++] = channel[i];
        if (this._writeIndex === CHUNK_SIZE) {
          this.port.postMessage(this._buffer.slice(0));
          this._writeIndex = 0;
        }
      }
    }
    return true; // keep the processor alive for the life of the call
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
