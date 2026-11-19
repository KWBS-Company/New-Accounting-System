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
