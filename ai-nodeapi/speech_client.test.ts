import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hasVoice, synthesize, transcribe } from "./speech_client.js";
import { decodeAudio } from "./wav.js";

// Integration test: needs ./models (run scripts/download-models.sh). Skipped otherwise.
const modelsReady =
  fs.existsSync("models/sherpa-onnx-whisper-base") && fs.existsSync("models/vits-piper-en_US-lessac-medium");
const opts = { skip: modelsReady ? false : "models not downloaded" };

test("hasVoice is language-code aware", () => {
  assert.equal(hasVoice("en"), true);
  assert.equal(hasVoice("en-US"), true);
  assert.equal(hasVoice("xx"), false);
});

test("synthesize returns null for a language without a voice", async () => {
  assert.equal(await synthesize("hi", "xx"), null);
});

test("TTS -> STT round trip", opts, async () => {
  const wav = await synthesize("Accounts receivable is money owed to you.", "en");
  assert.ok(wav && wav.length > 1000);
  const out = await transcribe(wav!, "a.wav", "audio/wav");
  assert.equal(out.language, "en");
  assert.match(out.text.toLowerCase(), /accounts receivable/);
  assert.ok(decodeAudio(wav!, "audio/wav").sampleRate === 22050);
});

test("concurrent calls are serialized without crashing", opts, async () => {
  const [a, b] = await Promise.all([synthesize("One.", "en"), synthesize("Two.", "en")]);
  assert.ok(a && b);
});
