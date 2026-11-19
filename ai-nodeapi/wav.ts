export interface Audio {
  samples: Float32Array;
  sampleRate: number;
}

/** Float samples in [-1, 1] -> mono 16-bit PCM WAV. */
export function encodeWav(samples: Float32Array, sampleRate: number): Buffer {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7fff), 44 + i * 2);
  }
  return buf;
}

/**
 * Decodes the audio formats we accept:
 *  - raw little-endian float32 mono PCM, mime `audio/x-pcm-f32;rate=<Hz>` (what the browser sends)
 *  - 16-bit PCM WAV (first channel is used)
 * Anything else (e.g. webm/opus) is rejected: Node has no decoder for it.
 */
export function decodeAudio(data: Buffer, mimeType: string): Audio {
  const mime = (mimeType ?? "").toLowerCase();
  if (mime.startsWith("audio/x-pcm-f32")) {
    const rate = Number(/rate=(\d+)/.exec(mime)?.[1] ?? 16000);
    const copy = new Uint8Array(data).buffer; // aligned copy
    return { samples: new Float32Array(copy, 0, Math.floor(copy.byteLength / 4)), sampleRate: rate };
  }
  if (data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WAVE") {
    let channels = 0, sampleRate = 0, bits = 0;
    let offset = 12;
    while (offset + 8 <= data.length) {
      const id = data.toString("ascii", offset, offset + 4);
      const size = data.readUInt32LE(offset + 4);
      const body = offset + 8;
      if (id === "fmt ") {
        channels = data.readUInt16LE(body + 2);
        sampleRate = data.readUInt32LE(body + 4);
        bits = data.readUInt16LE(body + 14);
      } else if (id === "data") {
        if (bits !== 16 || channels < 1) throw new Error("unsupported audio format: only 16-bit PCM WAV is supported");
        const available = Math.min(size, data.length - body);
        const frames = Math.floor(available / (2 * channels));
        const samples = new Float32Array(frames);
        for (let i = 0; i < frames; i++) samples[i] = data.readInt16LE(body + i * 2 * channels) / 0x8000;
        return { samples, sampleRate };
      }
      offset = body + size + (size % 2); // chunks are word-aligned
    }
  }
  throw new Error("unsupported audio format: send 16 kHz float32 PCM or 16-bit WAV");
}
