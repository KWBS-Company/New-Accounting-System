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
