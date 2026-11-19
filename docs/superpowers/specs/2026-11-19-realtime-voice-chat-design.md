# Real-time Voice Chat — Design

## Goal
Add voice to the existing AI chat: speak a question, hear the answer as it is generated, and have any assistant message read aloud. Speech is processed locally (no external API).

## Scope
- Frontend chat page: mic (real-time conversation) and per-message speaker button.
- nodeapi chat module: WebSocket gateway plus REST helpers, reusing existing chat persistence.
- ai-nodeapi: voice routes that wrap a local speech service and reuse `/api/chat/stream`.
- New speech service (Python, Docker): faster-whisper (STT, language auto-detect) and Piper (TTS).

Out of scope: telephony, voice cloning, multi-speaker handling, interpreter-style speech-to-speech between two people.

## Architecture
```
Browser mic -> WS (PCM chunks) -> nodeapi ChatGateway -> ai-nodeapi /api/voice/* -> speech service
Browser speaker <- audio + text <- nodeapi <- ai-nodeapi (LLM stream via Ollama, sentence-buffered TTS)
```

### Speech service (`speech-service/`)
- `POST /stt` (audio -> `{text, language}`), `POST /tts` (`{text, language}` -> audio/wav).
- Voices configurable per language via env; English default, Nepali if a voice is available.

### ai-nodeapi
- `voice_router.ts`, `voice_service.ts`.
- `POST /api/voice/transcribe`, `POST /api/voice/speak`.
- Real-time turn: transcript is sent to existing `chatStream`; tokens are buffered per sentence and each sentence goes to TTS as soon as it completes.
- Translation: system prompt instructs the model to reply in the spoken language, or in a user-chosen target language.

### nodeapi (chat module)
- `chat.gateway.ts` at `/ai-chat/voice` (WebSocket), JWT-authenticated like REST.
- Persists user transcript and assistant reply via existing `ChatService`.
- REST: `POST /ai-chat/voice/transcribe`, `POST /ai-chat/voice/speak`. Existing endpoints unchanged.

### Frontend (`Chat.tsx`)
- Mic button streams audio over WS; voice-activity detection ends a turn; user can interrupt playback.
- Live transcript appears in the normal message list.
- Speaker button on each assistant message calls `/speak`.

## Error handling
- Speech service down: voice UI shows an error, text chat unaffected.
- Mic permission denied or WS drop: fall back to text, allow retry.
- Unsupported language voice: reply as text only.

## Testing
- Unit: sentence buffer, WS auth, transcribe/speak routes (mock speech service).
- Manual: end-to-end in English and one other language.

## Assumptions
- Python/Docker are available to run the speech service.
- "Translation" means same-language reply by default plus optional target language.
