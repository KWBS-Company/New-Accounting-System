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
      if (err instanceof Error && /^unsupported audio format/i.test(err.message)) {
        return res.status(415).json({ error: err.message });
      }
      console.error(err);
      return res.status(502).json({ error: "speech engine unavailable" });
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
      return res.status(502).json({ error: "speech engine unavailable" });
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
