import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeAudio, encodeWav } from "./wav.js";

test("encodeWav writes a valid 16-bit mono header", () => {
  const wav = encodeWav(new Float32Array([0, 0.5, -0.5, 1]), 22050);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(20), 1); // PCM
  assert.equal(wav.readUInt16LE(22), 1); // mono
  assert.equal(wav.readUInt32LE(24), 22050);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 8); // 4 samples * 2 bytes
  assert.equal(wav.length, 44 + 8);
});

test("encodeWav -> decodeAudio round trip keeps samples within 16-bit precision", () => {
  const input = new Float32Array([0, 0.25, -0.25, 0.9, -0.9]);
  const out = decodeAudio(encodeWav(input, 16000), "audio/wav");
  assert.equal(out.sampleRate, 16000);
  assert.equal(out.samples.length, input.length);
  input.forEach((v, i) => assert.ok(Math.abs(out.samples[i] - v) < 1e-3));
});

test("decodeAudio reads raw float32 PCM with rate from the mime type", () => {
  const f32 = new Float32Array([0.1, -0.2, 0.3]);
  const out = decodeAudio(Buffer.from(f32.buffer), "audio/x-pcm-f32;rate=16000");
  assert.equal(out.sampleRate, 16000);
  assert.deepEqual(Array.from(out.samples), Array.from(f32));
});

test("decodeAudio rejects unsupported formats", () => {
  assert.throws(() => decodeAudio(Buffer.from("not audio"), "audio/webm"), /unsupported audio format/i);
});

test("decodeAudio skips extra chunks before the data chunk", () => {
  const base = encodeWav(new Float32Array([0.5, -0.5]), 16000);
  const list = Buffer.concat([Buffer.from("LIST"), Buffer.from([4, 0, 0, 0]), Buffer.from("abcd")]);
  const wav = Buffer.concat([base.subarray(0, 36), list, base.subarray(36)]);
  const out = decodeAudio(wav, "audio/wav");
  assert.equal(out.samples.length, 2);
  assert.ok(Math.abs(out.samples[0] - 0.5) < 1e-3);
});
