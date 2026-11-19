import { test } from "node:test";
import assert from "node:assert/strict";
import { SentenceBuffer, cleanForSpeech, guessLanguage } from "./sentence_buffer.js";

test("emits a sentence only after terminator + whitespace", () => {
  const b = new SentenceBuffer();
  assert.deepEqual(b.push("Hello wor"), []);
  assert.deepEqual(b.push("ld. How"), ["Hello world."]);
  assert.deepEqual(b.push(" are you?"), []);
  assert.equal(b.flush(), "How are you?");
  assert.equal(b.flush(), null);
});

test("does not split decimals", () => {
  const b = new SentenceBuffer();
  assert.deepEqual(b.push("Total is 3.5 dollars. Next"), ["Total is 3.5 dollars."]);
});

test("splits on newline and Devanagari danda", () => {
  const b = new SentenceBuffer();
  assert.deepEqual(b.push("Line one\nLine two। Three"), ["Line one", "Line two।"]);
});

test("cleanForSpeech strips markdown", () => {
  assert.equal(cleanForSpeech("**Bold** and `code` and [link](http://x.y)"), "Bold and code and link");
  assert.equal(cleanForSpeech("# Title\n- item"), "Title item");
});

test("guessLanguage", () => {
  assert.equal(guessLanguage("hello"), "en");
  assert.equal(guessLanguage("नमस्ते"), "ne");
});
