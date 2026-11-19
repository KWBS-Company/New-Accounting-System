// In-process speech engine (sherpa-onnx): Whisper for STT, Piper (VITS) for TTS.
// Models live in ./models (see scripts/download-models.sh). Pinned to sherpa-onnx-node 1.x
// because 2.x dropped the built-in phonemizer that Piper voices need.
import fs from "node:fs";
import path from "node:path";
import sherpa from "sherpa-onnx-node";
import { decodeAudio, encodeWav } from "./wav.js";

// language code -> directory of a sherpa Piper voice (contains *.onnx, tokens.txt, espeak-ng-data)
const VOICES: Record<string, string> = JSON.parse(
  process.env.PIPER_VOICES ?? '{"en": "models/vits-piper-en_US-lessac-medium"}',
);
const WHISPER_DIR = process.env.WHISPER_DIR ?? "models/sherpa-onnx-whisper-base";
const WHISPER_NAME = process.env.WHISPER_NAME ?? "base";

const abs = (p: string) => path.resolve(process.cwd(), p);

// The native recognizer/synthesizer are not documented as re-entrant: run calls one at a time.
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

let recognizer: any;
function getRecognizer() {
  if (!recognizer) {
    const dir = abs(WHISPER_DIR);
    recognizer = new sherpa.OfflineRecognizer({
      featConfig: { sampleRate: 16000, featureDim: 80 },
      modelConfig: {
        whisper: {
          encoder: path.join(dir, `${WHISPER_NAME}-encoder.int8.onnx`),
          decoder: path.join(dir, `${WHISPER_NAME}-decoder.int8.onnx`),
          language: "", // auto-detect
          task: "transcribe",
          tailPaddings: -1,
        },
        tokens: path.join(dir, `${WHISPER_NAME}-tokens.txt`),
        numThreads: 2,
        provider: "cpu",
        debug: 0,
      },
    });
  }
  return recognizer;
}

const voices = new Map<string, any>();
function getVoice(lang: string) {
  let tts = voices.get(lang);
  if (!tts) {
    const dir = abs(VOICES[lang]);
    const onnx = fs.readdirSync(dir).find((f) => f.endsWith(".onnx") && !f.endsWith(".onnx.json"));
    if (!onnx) throw new Error(`no .onnx voice file in ${dir}`);
    tts = new sherpa.OfflineTts({
      model: {
        vits: {
          model: path.join(dir, onnx),
          tokens: path.join(dir, "tokens.txt"),
          dataDir: path.join(dir, "espeak-ng-data"),
        },
        numThreads: 2,
        provider: "cpu",
        debug: false,
      },
      maxNumSentences: 1,
    });
    voices.set(lang, tts);
  }
  return tts;
}

export function hasVoice(language: string): boolean {
  return language.split("-")[0].toLowerCase() in VOICES;
}

export async function transcribe(
  audio: Buffer,
  _filename: string,
  mimeType: string,
): Promise<{ text: string; language: string }> {
  const { samples, sampleRate } = decodeAudio(audio, mimeType);
  return serialize(async () => {
    const rec = getRecognizer();
    const stream = rec.createStream();
    stream.acceptWaveform({ samples, sampleRate }); // resampled to 16 kHz internally
    const result = await rec.decodeAsync(stream);
    return { text: String(result.text ?? "").trim(), language: String(result.lang || "en") };
  });
}

/** Returns WAV bytes, or null when no voice is configured for the language. */
export async function synthesize(text: string, language: string): Promise<Buffer | null> {
  const lang = language.split("-")[0].toLowerCase();
  if (!hasVoice(lang)) return null;
  return serialize(async () => {
    const audio = await getVoice(lang).generateAsync({ text, sid: 0, speed: 1.0 });
    return encodeWav(audio.samples, audio.sampleRate);
  });
}
