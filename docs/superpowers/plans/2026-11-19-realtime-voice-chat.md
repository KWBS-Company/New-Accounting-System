# Real-time Voice Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-time voice conversation and read-aloud to the existing AI chat (frontend `Chat.tsx`, nodeapi chat module, ai-nodeapi), using local STT/TTS.

**Architecture:** A new Python speech service (faster-whisper + Piper) is called by ai-nodeapi. ai-nodeapi adds `/api/voice/*` routes, including a streaming chat route that emits text plus per-sentence audio. nodeapi adds a socket.io gateway (`/ai-chat/voice`) in the chat module that transcribes an utterance, runs the chat turn, persists it, and relays text and audio. The frontend records utterances with voice-activity detection (VAD) and plays audio as it arrives.

**Tech Stack:** Python 3.11 + FastAPI + faster-whisper + piper-tts; Node/TypeScript (Express 5 in ai-nodeapi, NestJS 11 + socket.io in nodeapi); React + Vite + socket.io-client.

**Spec:** `docs/superpowers/specs/2026-11-19-realtime-voice-chat-design.md`

## Global Constraints

- Speech is local only; no external speech API.
- Speech service port `2060`; ai-nodeapi stays on `2050`; nodeapi AI base URL stays `ChatService.aiEndpointBaseUrl` (`http://localhost:2050`).
- Existing endpoints (`POST /ai-chat`, `POST /api/chat/stream`) must keep working unchanged.
- Voice failures must never break text chat.
- ai-nodeapi has no test framework: use `node:test` via `tsx --test`. nodeapi uses jest (`*.spec.ts` under `src/`). Frontend has no test runner: verify with `npx tsc --noEmit` and manual steps.
- Default TTS voice is English only; other languages are added through the `PIPER_VOICES` JSON map. A language without a voice replies as text only.

## File Structure

| File | Responsibility |
|---|---|
| `speech-service/app.py` | FastAPI: `/stt`, `/tts`, `/health` |
| `speech-service/tests/test_app.py` | pytest with monkeypatched models |
| `speech-service/{requirements.txt,Dockerfile}` | packaging, downloads English voice |
| `ai-nodeapi/sentence_buffer.ts` | pure: split streamed tokens into speakable sentences, clean markdown, guess language |
| `ai-nodeapi/sentence_buffer.test.ts` | node:test |
| `ai-nodeapi/speech_client.ts` | axios client for the speech service |
| `ai-nodeapi/voice_service.ts`, `voice_router.ts` | `/api/voice/transcribe`, `/speak`, `/chat/stream` |
| `ai-nodeapi/chat_service.ts` (modify) | add `replyTokens()` generator |
| `ai-nodeapi/chat.dto.ts` (modify) | optional `language`, `targetLanguage` |
| `nodeapi/src/chat/ndjson.ts` + `ndjson.spec.ts` | pure NDJSON line splitter |
| `nodeapi/src/chat/voice.service.ts` | proxy transcribe/speak to ai-nodeapi |
| `nodeapi/src/chat/chat.service.ts` (modify) | add `chatVoice()` |
| `nodeapi/src/chat/chat.gateway.ts` | socket.io gateway |
| `nodeapi/src/chat/chat.controller.ts`, `chat.module.ts` (modify) | REST routes, wiring |
| `frontend/src/api/voice.ts` | `speakText()` |
| `frontend/src/hooks/useVoiceChat.ts` | socket, VAD, recording, playback queue |
| `frontend/src/pages/Chat.tsx` (modify) | mic button, speaker button, shared meta handler |

---

### Task 1: Speech service

**Files:**
- Create: `speech-service/app.py`, `speech-service/requirements.txt`, `speech-service/Dockerfile`, `speech-service/tests/test_app.py`

**Interfaces:**
- Produces: `POST /stt` (multipart `file`) -> `{"text": str, "language": str}`; `POST /tts` JSON `{"text": str, "language": str}` -> `audio/wav` bytes, or 404 `{"detail": "no voice for <lang>"}`; `GET /health` -> `{"status":"ok"}`.

- [ ] **Step 1: Write the failing test**

`speech-service/tests/test_app.py`:
```python
import app as speech
from fastapi.testclient import TestClient

client = TestClient(speech.app)

def test_health():
    assert client.get("/health").json() == {"status": "ok"}

def test_stt_returns_text_and_language(monkeypatch):
    monkeypatch.setattr(speech, "transcribe_file", lambda path: ("hello world", "en"))
    r = client.post("/stt", files={"file": ("a.webm", b"fake", "audio/webm")})
    assert r.status_code == 200
    assert r.json() == {"text": "hello world", "language": "en"}

def test_tts_returns_wav(monkeypatch):
    monkeypatch.setattr(speech, "synthesize", lambda text, lang: b"RIFFfake")
    r = client.post("/tts", json={"text": "hi", "language": "en"})
    assert r.status_code == 200
    assert r.headers["content-type"] == "audio/wav"
    assert r.content == b"RIFFfake"

def test_tts_unknown_language_is_404():
    r = client.post("/tts", json={"text": "hi", "language": "xx"})
    assert r.status_code == 404
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd speech-service && python -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt pytest httpx && pytest -q`
(create `requirements.txt` first, see Step 3). Expected before `app.py` exists: `ModuleNotFoundError: No module named 'app'`.

- [ ] **Step 3: Implement**

`speech-service/requirements.txt`:
```
fastapi==0.115.6
uvicorn==0.34.0
python-multipart==0.0.20
faster-whisper==1.1.0
piper-tts==1.3.0
```

`speech-service/app.py`:
```python
import io
import json
import os
import tempfile
import wave
from functools import lru_cache

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

app = FastAPI()

# language code -> path to a Piper .onnx voice. Extend via env, e.g.
# PIPER_VOICES='{"en":"voices/en_US-lessac-medium.onnx","ne":"voices/ne_NP-google-medium.onnx"}'
VOICES: dict[str, str] = json.loads(
    os.environ.get("PIPER_VOICES", '{"en": "voices/en_US-lessac-medium.onnx"}')
)


@lru_cache(maxsize=1)
def _whisper():
    from faster_whisper import WhisperModel

    return WhisperModel(
        os.environ.get("WHISPER_MODEL", "small"), device="cpu", compute_type="int8"
    )


@lru_cache(maxsize=None)
def _voice(lang: str):
    from piper import PiperVoice

    return PiperVoice.load(VOICES[lang])


def transcribe_file(path: str) -> tuple[str, str]:
    segments, info = _whisper().transcribe(path, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip(), info.language


def synthesize(text: str, lang: str) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav:
        _voice(lang).synthesize_wav(text, wav)
    return buf.getvalue()


class TtsRequest(BaseModel):
    text: str
    language: str = "en"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/stt")
async def stt(file: UploadFile = File(...)):
    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        text, language = transcribe_file(path)
    finally:
        os.unlink(path)
    return {"text": text, "language": language}


@app.post("/tts")
def tts(req: TtsRequest):
    lang = req.language.split("-")[0].lower()
    if lang not in VOICES:
        raise HTTPException(status_code=404, detail=f"no voice for {lang}")
    return Response(content=synthesize(req.text, lang), media_type="audio/wav")
```

`speech-service/Dockerfile`:
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN mkdir -p voices && cd voices && \
    curl -fsSLO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx && \
    curl -fsSLO https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json
COPY app.py .
EXPOSE 2060
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "2060"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd speech-service && pytest -q`
Expected: 4 passed.

- [ ] **Step 5: Smoke-test the real models**

Run: `docker build -t speech-service ./speech-service && docker run --rm -p 2060:2060 speech-service`, then
`curl -s -X POST localhost:2060/tts -H 'content-type: application/json' -d '{"text":"Hello from Piper","language":"en"}' -o /tmp/t.wav && file /tmp/t.wav` (Expected: `RIFF ... WAVE audio`), then
`curl -s -F file=@/tmp/t.wav localhost:2060/stt` (Expected: JSON text containing "hello").
If `synthesize_wav` does not exist in the pinned piper-tts, check that version's README for the equivalent wav-writing call and adjust `synthesize()` only.

- [ ] **Step 6: Commit**

```bash
git add speech-service
git commit -m "feat: add local speech service (faster-whisper + piper)"
```

---

### Task 2: ai-nodeapi sentence buffer (pure logic)

**Files:**
- Create: `ai-nodeapi/sentence_buffer.ts`, `ai-nodeapi/sentence_buffer.test.ts`
- Modify: `ai-nodeapi/package.json` (add `"test": "tsx --test sentence_buffer.test.ts"`)

**Interfaces:**
- Produces: `class SentenceBuffer { push(text: string): string[]; flush(): string | null }`, `cleanForSpeech(text: string): string`, `guessLanguage(text: string): string` (`'ne'` if Devanagari, else `'en'`).

- [ ] **Step 1: Write the failing test**

`ai-nodeapi/sentence_buffer.test.ts`:
```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd ai-nodeapi && npx tsx --test sentence_buffer.test.ts`
Expected: FAIL, cannot find module `./sentence_buffer.js`.

- [ ] **Step 3: Implement**

`ai-nodeapi/sentence_buffer.ts`:
```ts
// A sentence ends at . ! ? । followed by whitespace, or at a newline.
// Requiring trailing whitespace avoids splitting "3.5" mid-stream.
const BOUNDARY = /([.!?।]+)(\s+)|(\n+)/;

export class SentenceBuffer {
  private pending = "";

  push(text: string): string[] {
    this.pending += text;
    const out: string[] = [];
    while (true) {
      const m = BOUNDARY.exec(this.pending);
      if (!m) break;
      const end = m.index + (m[1] ?? "").length;
      const sentence = this.pending.slice(0, end).trim();
      this.pending = this.pending.slice(m.index + m[0].length);
      if (sentence) out.push(sentence);
    }
    return out;
  }

  flush(): string | null {
    const rest = this.pending.trim();
    this.pending = "";
    return rest || null;
  }
}

export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function guessLanguage(text: string): string {
  return /[ऀ-ॿ]/.test(text) ? "ne" : "en";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd ai-nodeapi && npx tsx --test sentence_buffer.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add ai-nodeapi/sentence_buffer.ts ai-nodeapi/sentence_buffer.test.ts ai-nodeapi/package.json
git commit -m "feat(ai-nodeapi): sentence buffer for streamed TTS"
```

---

### Task 3: ai-nodeapi voice routes

**Files:**
- Create: `ai-nodeapi/speech_client.ts`, `ai-nodeapi/voice_service.ts`, `ai-nodeapi/voice_router.ts`
- Modify: `ai-nodeapi/chat_service.ts` (add method after `chatStream`), `ai-nodeapi/chat.dto.ts` (add fields to `ChatDto`), `ai-nodeapi/server.ts` (mount router)

**Interfaces:**
- Consumes: `SentenceBuffer`, `cleanForSpeech`, `guessLanguage` (Task 2); speech service HTTP API (Task 1).
- Produces:
  - `POST /api/voice/transcribe` (multipart `file`) -> `{text, language}`
  - `POST /api/voice/speak` JSON `{text, language?}` -> `audio/wav`, or 204 when no voice
  - `POST /api/voice/chat/stream` body = existing `ChatDto` plus optional `language`, `targetLanguage` -> NDJSON lines `{"type":"text","content":string}`, `{"type":"audio","sentence":string,"audio":"<base64 wav>"}`, `{"type":"done"}`, `{"type":"error","message":string}`.
  - `chatService.replyTokens(dto: ChatDto, signal: {aborted: boolean}): AsyncGenerator<string>`

- [ ] **Step 1: Add DTO fields**

In `ai-nodeapi/chat.dto.ts`, inside `class ChatDto` after `stream?: boolean;`:
```ts
    @IsOptional()
    @IsString()
    language?: string;

    @IsOptional()
    @IsString()
    targetLanguage?: string;
```

- [ ] **Step 2: Add `replyTokens` to `ChatService`** (inside the class, after `chatStream`; imports `BaseMessage`, `getAgent`, `ChatDto` already exist in the file)

```ts
    // Token generator used by the voice route. chatStream is left untouched
    // so the text chat path is not at risk.
    async *replyTokens(
        dto: ChatDto,
        signal: { aborted: boolean },
    ): AsyncGenerator<string> {
        const customerId = dto.userInfo.customerId ?? dto.userInfo.companyId;
        const agent = await getAgent(customerId);
        const stream = await agent.stream(
            {
                messages: [
                    this.buildUserInfoMessage(dto.userInfo),
                    ...dto.messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                ],
            },
            { streamMode: "messages" },
        );
        for await (const chunk of stream) {
            if (signal.aborted) return;
            const [message] = chunk as [BaseMessage, Record<string, unknown>];
            if (message.type !== "ai" && message.type !== "AIMessageChunk") continue;
            const content = message.text;
            if (content) yield content;
        }
    }
```

- [ ] **Step 3: Speech client**

`ai-nodeapi/speech_client.ts`:
```ts
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
```

- [ ] **Step 4: Voice service**

`ai-nodeapi/voice_service.ts`:
```ts
import { Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ChatDto, ChatRole } from "./chat.dto.js";
import { chatService } from "./chat_service.js";
import { SentenceBuffer, cleanForSpeech, guessLanguage } from "./sentence_buffer.js";
import { synthesize, transcribe } from "./speech_client.js";

const LANGUAGE_NAMES: Record<string, string> = { en: "English", ne: "Nepali", hi: "Hindi" };

class VoiceService {
  async transcribe(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ error: "file is required" });
    try {
      const result = await transcribe(req.file.buffer, req.file.originalname, req.file.mimetype);
      return res.json(result);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "speech service unavailable" });
    }
  }

  async speak(req: Request, res: Response) {
    const text = cleanForSpeech(String(req.body?.text ?? ""));
    if (!text) return res.status(400).json({ error: "text is required" });
    const language = req.body?.language ?? guessLanguage(text);
    try {
      const wav = await synthesize(text, language);
      if (!wav) return res.status(204).end();
      res.setHeader("Content-Type", "audio/wav");
      return res.send(wav);
    } catch (err) {
      console.error(err);
      return res.status(502).json({ error: "speech service unavailable" });
    }
  }

  async chatStream(req: Request, res: Response) {
    const dto = plainToInstance(ChatDto, req.body);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (errors.length > 0) return res.status(400).json({ success: false, errors });

    const instruction = dto.targetLanguage
      ? `Always reply in ${LANGUAGE_NAMES[dto.targetLanguage] ?? dto.targetLanguage}.`
      : "Reply in the same language the user used in their last message.";
    dto.messages = [{ role: ChatRole.SYSTEM, content: instruction }, ...dto.messages];

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.flushHeaders?.();

    const signal = { aborted: false };
    res.on("close", () => { signal.aborted = true; });
    const send = (obj: unknown) => { if (!res.writableEnded) res.write(JSON.stringify(obj) + "\n"); };

    const speakSentence = async (raw: string) => {
      const sentence = cleanForSpeech(raw);
      if (!sentence) return;
      const lang = dto.targetLanguage ?? dto.language ?? guessLanguage(sentence);
      try {
        const wav = await synthesize(sentence, lang);
        if (wav && !signal.aborted) send({ type: "audio", sentence, audio: wav.toString("base64") });
      } catch (err) {
        console.error("TTS failed, continuing text-only", err);
      }
    };

    try {
      const buffer = new SentenceBuffer();
      for await (const token of chatService.replyTokens(dto, signal)) {
        send({ type: "text", content: token });
        for (const sentence of buffer.push(token)) await speakSentence(sentence);
      }
      const rest = buffer.flush();
      if (rest) await speakSentence(rest);
      send({ type: "done" });
    } catch (err) {
      console.error(err);
      send({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
    res.end();
  }
}

export const voiceService = new VoiceService();
```

- [ ] **Step 5: Router and mount**

`ai-nodeapi/voice_router.ts`:
```ts
import { Request, Response, Router } from "express";
import multer from "multer";
import { voiceService } from "./voice_service.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/voice/transcribe", upload.single("file"), (req: Request, res: Response) => voiceService.transcribe(req, res));
router.post("/voice/speak", (req: Request, res: Response) => voiceService.speak(req, res));
router.post("/voice/chat/stream", (req: Request, res: Response) => voiceService.chatStream(req, res));

export default router;
```

In `ai-nodeapi/server.ts` add `import voiceRouter from './voice_router.js';` and after `app.use('/api', ragRouter);` add `app.use('/api', voiceRouter);`.

- [ ] **Step 6: Typecheck and smoke test**

Run: `cd ai-nodeapi && npx tsc --noEmit` (Expected: no errors). Start the speech service (Task 1) and ai-nodeapi (`npm run dev`), then:
`curl -s -X POST localhost:2050/api/voice/speak -H 'content-type: application/json' -d '{"text":"**Hello** there."}' -o /tmp/s.wav && file /tmp/s.wav` (Expected: WAVE audio).
`curl -N -X POST localhost:2050/api/voice/chat/stream -H 'content-type: application/json' -d '{"messages":[{"role":"user","content":"Say hi in two sentences."}],"userInfo":{"email":"a@b.co","companyId":"1","companyName":"X","fullName":"T"}}'`
Expected: interleaved `text` lines, `audio` lines, then `{"type":"done"}` (needs Ollama running).

- [ ] **Step 7: Commit**

```bash
git add ai-nodeapi
git commit -m "feat(ai-nodeapi): voice transcribe/speak/chat-stream routes"
```

---

### Task 4: nodeapi voice service, REST routes, NDJSON helper

**Files:**
- Create: `nodeapi/src/chat/ndjson.ts`, `nodeapi/src/chat/ndjson.spec.ts`, `nodeapi/src/chat/voice.service.ts`
- Modify: `nodeapi/src/chat/chat.controller.ts`, `nodeapi/src/chat/chat.module.ts`

**Interfaces:**
- Produces: `splitNdjson(buffer: string): { lines: string[]; rest: string }`; `VoiceService.transcribe(file: Buffer, filename: string, mimeType: string): Promise<{text: string; language: string}>`; `VoiceService.speak(text: string, language?: string): Promise<Buffer | null>`; REST `POST /ai-chat/voice/transcribe` (multipart `file`), `POST /ai-chat/voice/speak` (`{text, language?}` -> `audio/wav` or 204).

- [ ] **Step 1: Write the failing test**

`nodeapi/src/chat/ndjson.spec.ts`:
```ts
import { splitNdjson } from './ndjson';

describe('splitNdjson', () => {
    it('returns complete lines and keeps the partial remainder', () => {
        expect(splitNdjson('{"a":1}\n{"b":2}\n{"c"')).toEqual({
            lines: ['{"a":1}', '{"b":2}'],
            rest: '{"c"',
        });
    });
    it('skips blank lines', () => {
        expect(splitNdjson('\n{"a":1}\n\n')).toEqual({ lines: ['{"a":1}'], rest: '' });
    });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd nodeapi && npx jest --config jest.config.json ndjson`
Expected: FAIL, cannot find module `./ndjson`.

- [ ] **Step 3: Implement helper and service**

`nodeapi/src/chat/ndjson.ts`:
```ts
export function splitNdjson(buffer: string): { lines: string[]; rest: string } {
    const parts = buffer.split('\n');
    const rest = parts.pop() ?? '';
    return { lines: parts.map((l) => l.trim()).filter(Boolean), rest };
}
```

`nodeapi/src/chat/voice.service.ts`:
```ts
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import FormData from 'form-data';

@Injectable()
export class VoiceService {
    private static base = 'http://localhost:2050/api/voice';

    async transcribe(file: Buffer, filename: string, mimeType: string) {
        const form = new FormData();
        form.append('file', file, { filename, contentType: mimeType });
        const res = await axios.post<{ text: string; language: string }>(
            `${VoiceService.base}/transcribe`,
            form,
            { headers: form.getHeaders() },
        );
        return res.data;
    }

    /** WAV bytes, or null when no voice exists for the language. */
    async speak(text: string, language?: string): Promise<Buffer | null> {
        const res = await axios.post<ArrayBuffer>(
            `${VoiceService.base}/speak`,
            { text, language },
            { responseType: 'arraybuffer', validateStatus: (s) => s === 200 || s === 204 },
        );
        return res.status === 204 ? null : Buffer.from(res.data);
    }
}
```

- [ ] **Step 4: Controller routes**

In `chat.controller.ts` add imports `HttpException, HttpStatus` to the `@nestjs/common` import, `memoryStorage` to the multer import, `import { VoiceService } from './voice.service';`; inject `private readonly voiceService: VoiceService` in the constructor; add before `@Post('upload')`:
```ts
    @ApiBearerAuth('accessToken')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    @Post('voice/transcribe')
    async transcribeVoice(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new HttpException('file is required', HttpStatus.BAD_REQUEST);
        try {
            return await this.voiceService.transcribe(file.buffer, file.originalname, file.mimetype);
        } catch {
            throw new HttpException('Voice service unavailable', HttpStatus.BAD_GATEWAY);
        }
    }

    @ApiBearerAuth('accessToken')
    @Post('voice/speak')
    async speak(@Body() body: { text: string; language?: string }, @Res() res: Response) {
        if (!body?.text?.trim()) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'text is required' });
        }
        try {
            const wav = await this.voiceService.speak(body.text, body.language);
            if (!wav) return res.status(HttpStatus.NO_CONTENT).end();
            res.setHeader('Content-Type', 'audio/wav');
            return res.send(wav);
        } catch {
            return res.status(HttpStatus.BAD_GATEWAY).json({ message: 'Voice service unavailable' });
        }
    }
```
In `chat.module.ts` add `VoiceService` to `providers`.

- [ ] **Step 5: Verify**

Run: `cd nodeapi && npx jest --config jest.config.json ndjson` (Expected: 2 passed) and `npx tsc --noEmit` (Expected: no errors). With services running, `curl -X POST localhost:3001/api/v1/ai-chat/voice/speak -H "Authorization: Bearer <token>" -H 'content-type: application/json' -d '{"text":"Hello"}' -o /tmp/n.wav` yields WAVE audio.

- [ ] **Step 6: Commit**

```bash
git add nodeapi/src/chat
git commit -m "feat(nodeapi): voice transcribe/speak endpoints"
```

---

### Task 5: nodeapi `chatVoice` + socket.io gateway

**Files:**
- Modify: `nodeapi/src/chat/chat.service.ts` (add method), `nodeapi/src/chat/chat.module.ts`
- Create: `nodeapi/src/chat/chat.gateway.ts`

**Interfaces:**
- Consumes: `splitNdjson`, `VoiceService` (Task 4); `/api/voice/chat/stream` (Task 3); `aiChatRequestMapper`, `getChatInfo` (existing).
- Produces: `ChatService.chatVoice(user: User, req: {question: string; chatId?: string; model?: string; language?: string; targetLanguage?: string}, signal: AbortSignal, emit: (e: VoiceEvent) => void): Promise<void>` with
  `type VoiceEvent = {type:'token',text:string} | {type:'audio',sentence:string,audio:Buffer} | {type:'meta',chatId:string,chatTitle:string} | {type:'error',message:string}`.
- Socket protocol (namespace `/ai-chat/voice`, auth `{token}` in handshake): client emits `voice:audio` `{audio: ArrayBuffer, mimeType: string, chatId?: string, model?: string, targetLanguage?: string}` and `voice:cancel`; server emits `voice:transcript` `{text, language}`, `voice:token` `{text}`, `voice:audio` `{sentence, audio: Buffer}`, `voice:done` `{chatId, chatTitle}`, `voice:error` `{message}`.

- [ ] **Step 1: Add `chatVoice` to `ChatService`**

Add near the top of `chat.service.ts`: `import { splitNdjson } from './ndjson';` and export:
```ts
export type VoiceEvent =
    | { type: 'token'; text: string }
    | { type: 'audio'; sentence: string; audio: Buffer }
    | { type: 'meta'; chatId: string; chatTitle: string }
    | { type: 'error'; message: string };
```
Add the method inside the class (after `chat`):
```ts
    async chatVoice(
        user: User,
        req: { question: string; chatId?: string; model?: string; language?: string; targetLanguage?: string },
        signal: AbortSignal,
        emit: (e: VoiceEvent) => void,
    ): Promise<void> {
        const chatDto = Object.assign(new ChatDto(), {
            question: req.question,
            chatId: req.chatId,
            model: req.model,
        });
        const chatInfo = await this.getChatInfo(user, chatDto);
        const conversations = req.chatId
            ? await this.chatConversationRepository.find({
                  where: { deletedAt: IsNull(), chatId: req.chatId },
              })
            : [];
        const payload = {
            ...aiChatRequestMapper(conversations, chatDto, user),
            language: req.language,
            targetLanguage: req.targetLanguage,
        };

        const response = await axios.post<Readable>(
            `${ChatService.aiEndpointBaseUrl}/api/voice/chat/stream`,
            payload,
            { responseType: 'stream', signal },
        );

        let answer = '';
        let buffer = '';
        for await (const chunk of response.data) {
            const split = splitNdjson(buffer + (chunk as Buffer).toString('utf8'));
            buffer = split.rest;
            for (const line of split.lines) {
                try {
                    const evt = JSON.parse(line) as {
                        type: string; content?: string; sentence?: string; audio?: string; message?: string;
                    };
                    if (evt.type === 'text' && evt.content) {
                        answer += evt.content;
                        emit({ type: 'token', text: evt.content });
                    } else if (evt.type === 'audio' && evt.audio) {
                        emit({ type: 'audio', sentence: evt.sentence ?? '', audio: Buffer.from(evt.audio, 'base64') });
                    } else if (evt.type === 'error') {
                        emit({ type: 'error', message: evt.message ?? 'AI error' });
                    }
                } catch {
                    this.logger.debug('Skipped invalid NDJSON line');
                }
            }
        }

        if (signal.aborted || !answer) return;
        const conversation = new ChatConversation();
        conversation.chat = chatInfo;
        conversation.question = req.question;
        conversation.answer = answer;
        const chat = await this.chatRepository.save(chatInfo);
        await this.chatConversationRepository.save(conversation);
        emit({ type: 'meta', chatId: chat.id, chatTitle: chat.chatTitle });
    }
```

- [ ] **Step 2: Gateway**

`nodeapi/src/chat/chat.gateway.ts`:
```ts
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
    SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserService } from 'src/auth/users.service';
import { User } from 'src/auth/entities/user.entity';
import { ChatService } from './chat.service';
import { VoiceService } from './voice.service';

interface VoiceAudioMsg {
    audio: ArrayBuffer;
    mimeType: string;
    chatId?: string;
    model?: string;
    targetLanguage?: string;
}

@WebSocketGateway({
    namespace: '/ai-chat/voice',
    cors: { origin: true, credentials: true },
    maxHttpBufferSize: 25 * 1024 * 1024,
})
export class ChatVoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatVoiceGateway.name);
    private readonly inflight = new Map<string, AbortController>();

    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly users: UserService,
        private readonly chat: ChatService,
        private readonly voice: VoiceService,
    ) {}

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token as string | undefined;
            if (!token) throw new Error('missing token');
            const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
                secret: this.config.getOrThrow<string>('jwt.secret'),
            });
            const user = await this.users.findById(payload.sub);
            if (!user || !user.isActive || !user.isEmailVerified || user.userRoles.length === 0) {
                throw new Error('user not allowed');
            }
            client.data.user = user;
        } catch (e) {
            this.logger.debug(`Voice socket rejected: ${(e as Error).message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.inflight.get(client.id)?.abort();
        this.inflight.delete(client.id);
    }

    @SubscribeMessage('voice:cancel')
    cancel(@ConnectedSocket() client: Socket) {
        this.inflight.get(client.id)?.abort();
        this.inflight.delete(client.id);
    }

    @SubscribeMessage('voice:audio')
    async onAudio(@ConnectedSocket() client: Socket, @MessageBody() msg: VoiceAudioMsg) {
        const user = client.data.user as User;
        this.cancel(client); // a new utterance supersedes the running turn
        const controller = new AbortController();
        this.inflight.set(client.id, controller);

        try {
            const ext = msg.mimeType?.includes('ogg') ? 'ogg' : 'webm';
            const { text, language } = await this.voice.transcribe(
                Buffer.from(msg.audio), `utterance.${ext}`, msg.mimeType || 'audio/webm',
            );
            if (!text.trim()) {
                client.emit('voice:error', { message: "I didn't catch that." });
                return;
            }
            client.emit('voice:transcript', { text, language });

            let meta: { chatId: string; chatTitle: string } | undefined;
            await this.chat.chatVoice(
                user,
                { question: text, chatId: msg.chatId, model: msg.model, language, targetLanguage: msg.targetLanguage },
                controller.signal,
                (e) => {
                    if (controller.signal.aborted) return;
                    if (e.type === 'token') client.emit('voice:token', { text: e.text });
                    else if (e.type === 'audio') client.emit('voice:audio', { sentence: e.sentence, audio: e.audio });
                    else if (e.type === 'meta') meta = { chatId: e.chatId, chatTitle: e.chatTitle };
                    else client.emit('voice:error', { message: e.message });
                },
            );
            if (!controller.signal.aborted && meta) client.emit('voice:done', meta);
        } catch (err) {
            if (controller.signal.aborted) return;
            this.logger.error('Voice turn failed', (err as Error).stack);
            client.emit('voice:error', { message: 'Voice chat is unavailable right now.' });
        } finally {
            if (this.inflight.get(client.id) === controller) this.inflight.delete(client.id);
        }
    }
}
```
Verify the `UserService` import path/export against `nodeapi/src/auth/users.service.ts` (the JWT strategy imports it as `../users.service`).

- [ ] **Step 3: Wire the module**

In `chat.module.ts`: `import { AuthModule } from 'src/auth/auth.module'; import { ChatVoiceGateway } from './chat.gateway';` add `AuthModule` to `imports` (it exports `JwtModule` and `UserService`) and `ChatVoiceGateway` to `providers`. If Nest reports a circular dependency, use `forwardRef(() => AuthModule)`.

- [ ] **Step 4: Verify**

Run: `cd nodeapi && npx tsc --noEmit` (Expected: no errors) then `npm run start:dev` (Expected: no DI errors on boot). Connect a test client:
```bash
node -e "const {io}=require('socket.io-client');const s=io('http://localhost:3001/ai-chat/voice',{auth:{token:'BAD'}});s.on('disconnect',r=>{console.log('rejected',r);process.exit(0)})"
```
Expected: `rejected io server disconnect`. (`socket.io-client` is installed in the frontend; run from `frontend/` or `npx -p socket.io-client`.) Repeat with a valid token and confirm the socket stays connected.

- [ ] **Step 5: Commit**

```bash
git add nodeapi/src/chat
git commit -m "feat(nodeapi): voice chat gateway and chatVoice turn"
```

---

### Task 6: Frontend voice hook, read-aloud, mic button

**Files:**
- Modify: `frontend/package.json` (dep), `frontend/src/pages/Chat.tsx`
- Create: `frontend/src/api/voice.ts`, `frontend/src/hooks/useVoiceChat.ts`

**Interfaces:**
- Consumes: socket protocol (Task 5), `POST /ai-chat/voice/speak` (Task 4).
- Produces: `speakText(text: string): Promise<Blob | null>`; `useVoiceChat(getContext, handlers)` returning `{ state: VoiceState; start(): Promise<void>; stop(): void }`.

- [ ] **Step 1: Install**

Run: `cd frontend && npm i socket.io-client`

- [ ] **Step 2: speakText**

`frontend/src/api/voice.ts`:
```ts
import apiClient from './client'

/** Returns WAV audio for the text, or null if no voice exists for its language. */
export async function speakText(text: string, language?: string): Promise<Blob | null> {
  const res = await apiClient.post(
    '/ai-chat/voice/speak',
    { text, language },
    { responseType: 'blob', validateStatus: (s) => s === 200 || s === 204 },
  )
  return res.status === 204 ? null : (res.data as Blob)
}
```

- [ ] **Step 3: Voice hook**

`frontend/src/hooks/useVoiceChat.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { TOKEN_KEY } from '@/api/client'

export type VoiceState = 'off' | 'listening' | 'thinking' | 'speaking'

type Context = { chatId?: string; model?: string; targetLanguage?: string }
type Handlers = {
  onTranscript: (text: string, language: string) => void
  onToken: (text: string) => void
  onDone: (chatId: string, chatTitle: string) => void
  onError: (message: string) => void
}

const START_RMS = 0.04 // loudness that counts as speech
const BARGE_IN_RMS = 0.09 // higher bar while the assistant is speaking (avoids echo triggering)
const SILENCE_MS = 900 // quiet this long = end of utterance
const MIN_UTTERANCE_MS = 400

function socketOrigin(): string {
  const base = import.meta.env.VITE_API_URL ?? ''
  try {
    return new URL(base, window.location.origin).origin
  } catch {
    return window.location.origin
  }
}

export function useVoiceChat(getContext: () => Context, handlers: Handlers) {
  const [state, setState] = useState<VoiceState>('off')
  const stateRef = useRef<VoiceState>('off')
  const handlersRef = useRef(handlers)
  const contextRef = useRef(getContext)
  handlersRef.current = handlers
  contextRef.current = getContext

  const socketRef = useRef<Socket | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<number | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const playQueue = useRef<string[]>([])
  const playerRef = useRef<HTMLAudioElement | null>(null)

  const set = (s: VoiceState) => {
    stateRef.current = s
    setState(s)
  }

  const stopPlayback = useCallback(() => {
    playQueue.current.forEach((u) => URL.revokeObjectURL(u))
    playQueue.current = []
    playerRef.current?.pause()
    playerRef.current = null
  }, [])

  const playNext = useCallback(() => {
    if (playerRef.current) return
    const url = playQueue.current.shift()
    if (!url) {
      if (stateRef.current === 'speaking') set('listening')
      return
    }
    const audio = new Audio(url)
    playerRef.current = audio
    set('speaking')
    const finish = () => {
      URL.revokeObjectURL(url)
      playerRef.current = null
      playNext()
    }
    audio.onended = finish
    audio.onerror = finish
    void audio.play().catch(finish)
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.onstop = null
      recorderRef.current.stop()
    }
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    socketRef.current?.emit('voice:cancel')
    socketRef.current?.disconnect()
    socketRef.current = null
    stopPlayback()
    set('off')
  }, [stopPlayback])

  const start = useCallback(async () => {
    if (stateRef.current !== 'off') return
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
    } catch {
      handlersRef.current.onError('Microphone access was denied.')
      return
    }
    streamRef.current = stream

    const socket = io(`${socketOrigin()}/ai-chat/voice`, {
      auth: { token: localStorage.getItem(TOKEN_KEY) ?? '' },
    })
    socketRef.current = socket
    socket.on('voice:transcript', (m: { text: string; language: string }) => {
      set('thinking')
      handlersRef.current.onTranscript(m.text, m.language)
    })
    socket.on('voice:token', (m: { text: string }) => handlersRef.current.onToken(m.text))
    socket.on('voice:audio', (m: { audio: ArrayBuffer }) => {
      playQueue.current.push(URL.createObjectURL(new Blob([m.audio], { type: 'audio/wav' })))
      playNext()
    })
    socket.on('voice:done', (m: { chatId: string; chatTitle: string }) => {
      handlersRef.current.onDone(m.chatId, m.chatTitle)
      if (stateRef.current === 'thinking') set('listening')
    })
    socket.on('voice:error', (m: { message: string }) => {
      handlersRef.current.onError(m.message)
      if (stateRef.current === 'thinking') set('listening')
    })
    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        handlersRef.current.onError('Voice connection was rejected. Please sign in again.')
        stop()
      }
    })

    // Voice-activity detection: one MediaRecorder per utterance.
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    ctx.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.fftSize)

    let startedAt = 0
    let lastVoiceAt = 0

    const beginUtterance = () => {
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data)
      rec.onstop = async () => {
        const duration = Date.now() - startedAt
        const blob = new Blob(chunksRef.current, { type: rec.mimeType })
        recorderRef.current = null
        if (duration < MIN_UTTERANCE_MS || !socketRef.current) return
        set('thinking')
        socketRef.current.emit('voice:audio', {
          audio: await blob.arrayBuffer(),
          mimeType: rec.mimeType,
          ...contextRef.current(),
        })
      }
      startedAt = Date.now()
      rec.start()
    }

    timerRef.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const v of samples) sum += ((v - 128) / 128) ** 2
      const rms = Math.sqrt(sum / samples.length)
      const now = Date.now()
      const threshold = stateRef.current === 'speaking' ? BARGE_IN_RMS : START_RMS

      if (rms > threshold) {
        lastVoiceAt = now
        if (!recorderRef.current) {
          if (stateRef.current === 'speaking' || stateRef.current === 'thinking') {
            socketRef.current?.emit('voice:cancel') // barge-in: interrupt the assistant
            stopPlayback()
          }
          beginUtterance()
        }
      } else if (recorderRef.current && now - lastVoiceAt > SILENCE_MS) {
        recorderRef.current.stop()
      }
    }, 50)

    set('listening')
  }, [playNext, stop, stopPlayback])

  useEffect(() => stop, [stop])

  return { state, start, stop }
}
```
Known limitation (documented, accepted): the first ~50-100 ms of an utterance can be clipped because recording starts once speech is detected.

- [ ] **Step 4: Chat.tsx — shared meta handler**

In `Chat.tsx`, extract the body of the existing `onMeta` callback in `handleSend` (the `if (!activeChatId) {...} else {...}` block plus the `pending: false` update) into a function declared before `handleSend`:
```ts
  const handleMeta = (assistantId: string, chatId: string, chatTitle: string) => {
    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, pending: false } : m)))
    if (!activeChatId) {
      setActiveChatId(chatId)
      navigate(`/chat/${chatId}`, { replace: true })
      setChats((prev) => [
        {
          id: chatId, chatTitle,
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          deletedAt: null, customerId: '',
        },
        ...prev,
      ])
    } else {
      setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, updatedAt: new Date().toISOString() } : c)))
    }
  }
```
and change `onMeta` in `handleSend` to `onMeta: (chatId, chatTitle) => handleMeta(assistantMsg.id, chatId, chatTitle),`.

- [ ] **Step 5: Chat.tsx — mic button and hook wiring**

Add imports: `Mic, MicOff` to the existing `lucide-react` import list; `import { useVoiceChat } from '@/hooks/useVoiceChat'`.

Inside `Chat()` after `handleMeta`:
```ts
  const voiceAssistantId = useRef<string | null>(null)

  const voice = useVoiceChat(
    () => ({ chatId: activeChatId, model: selectedModel }),
    {
      onTranscript: (text) => {
        const stamp = Date.now()
        const assistantId = `local-${stamp}-a`
        voiceAssistantId.current = assistantId
        setMessages((prev) => [
          ...prev,
          { id: `local-${stamp}-u`, role: 'user', content: text },
          { id: assistantId, role: 'assistant', content: '', pending: true },
        ])
      },
      onToken: (text) => {
        const id = voiceAssistantId.current
        if (!id) return
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + text, pending: false } : m)))
      },
      onDone: (chatId, chatTitle) => {
        if (voiceAssistantId.current) handleMeta(voiceAssistantId.current, chatId, chatTitle)
      },
      onError: (message) => toast(message, 'error'),
    },
  )
```
Next to the Send/Stop button (inside the `streaming ? ... : ...` area, as a sibling before it) add:
```tsx
              <Button
                size="icon"
                variant={voice.state === 'off' ? 'ghost' : 'default'}
                onClick={() => (voice.state === 'off' ? void voice.start() : voice.stop())}
                title={voice.state === 'off' ? 'Start voice chat' : `Voice: ${voice.state} (click to stop)`}
              >
                {voice.state === 'off' ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
```

- [ ] **Step 6: Chat.tsx — read-aloud button on assistant messages**

Add `Volume2` to the lucide import and `import { speakText } from '@/api/voice'`. In `MessageBubble`, add state and handler next to `handleCopy`:
```ts
  const [speaking, setSpeaking] = useState(false)
  const handleSpeak = async () => {
    if (speaking) return
    setSpeaking(true)
    try {
      const blob = await speakText(message.content)
      if (!blob) {
        toast('No voice available for this language', 'error')
        return
      }
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); setSpeaking(false) }
      audio.onerror = () => { URL.revokeObjectURL(url); setSpeaking(false) }
      await audio.play()
      return
    } catch {
      toast('Could not read this message aloud', 'error')
    }
    setSpeaking(false)
  }
```
and, inside the existing `!showThinking && message.content &&` block, wrap the Copy button and a new speaker button in a flex row, adding for non-user messages:
```tsx
          {!isUser && (
            <button
              onClick={handleSpeak}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-opacity px-1 opacity-0 group-hover:opacity-100"
              title="Read aloud"
            >
              <Volume2 className="h-3 w-3" />
              {speaking ? 'Speaking…' : 'Listen'}
            </button>
          )}
```
(Wrap Copy + Listen in `<div className="flex items-center gap-2">` so they sit side by side.)

- [ ] **Step 7: Verify**

Run: `cd frontend && npx tsc --noEmit` (Expected: no errors).
Manual end-to-end (speech service, Ollama, ai-nodeapi, nodeapi, frontend all running):
1. Click "Listen" on an assistant message -> audio plays.
2. Click the mic, allow permission, say "What is accounts receivable?" -> user bubble with transcript appears, assistant text streams, sentences are spoken while the rest is still generating.
3. Speak while the assistant is talking -> playback stops and the new question is answered.
4. Reload the page -> the voice conversation is in the history.
5. Stop the speech service -> mic shows an error toast; typing in the textbox still works.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat(frontend): real-time voice chat and read-aloud"
```

---

### Task 7: Docs

**Files:**
- Modify: `Readme.md`

- [ ] **Step 1:** Add a "Voice chat" section to `Readme.md` listing: run the speech service (`docker run -p 2060:2060 speech-service`), env `SPEECH_SERVICE_URL` (ai-nodeapi, default `http://localhost:2060`), `PIPER_VOICES` (extra languages, e.g. Nepali) and `WHISPER_MODEL` (default `small`), and the browser requirement (Chrome/Edge/Safari with microphone permission, HTTPS or localhost).
- [ ] **Step 2: Commit**

```bash
git add Readme.md
git commit -m "docs: voice chat setup"
```

---

## Self-Review

- **Spec coverage:** speech service (Task 1); ai-nodeapi transcribe/speak and sentence-buffered streaming TTS plus translation prompt (Tasks 2-3); nodeapi gateway with JWT auth, persistence through the existing entities, REST helpers (Tasks 4-5); frontend mic with VAD and interrupt, live transcript, per-message speaker (Task 6); error handling: speech service down -> toast and text chat intact (Tasks 3, 5, 6), no voice for a language -> text-only (Tasks 1, 3, 6); testing: unit tests for the sentence buffer, NDJSON splitter and speech endpoints, manual E2E (Tasks 1, 2, 4, 6).
- **Spec deviation:** audio is sent per utterance (VAD-segmented blobs) rather than raw PCM chunks. This keeps the same user-facing behavior (speak, hear a reply while it generates, interrupt) with much less code, because Whisper works on whole utterances.
- **Types:** `VoiceEvent`, socket event names and payloads are identical in Tasks 5 and 6; NDJSON line types are identical in Tasks 3 and 5.
