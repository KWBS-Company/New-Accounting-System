import axios from "axios";

const BASE = process.env.SPEECH_SERVICE_URL ?? "http://localhost:2060";

export async function transcribe(
  audio: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ text: string; language: string }> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), filename);
  const res = await axios.post(`${BASE}/stt`, form);
  return res.data;
}

/** Returns WAV bytes, or null when no voice is configured for the language. */
export async function synthesize(text: string, language: string): Promise<Buffer | null> {
  try {
    const res = await axios.post(`${BASE}/tts`, { text, language }, { responseType: "arraybuffer" });
    return Buffer.from(res.data);
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) return null;
    throw err;
  }
}
