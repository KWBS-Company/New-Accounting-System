import { extname, basename } from "node:path";
import { readFile } from "node:fs/promises";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";

export interface LoadedChunk {
  content: string;
  source: string;
}

/**
 * Splits a long text into overlapping chunks so each embedded piece stays small
 * enough to be meaningful for retrieval.
 */
export function chunkText(
  text: string,
  source: string,
  chunkSize = 1000,
  overlap = 150,
): LoadedChunk[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) {
    return [];
  }

  const chunks: LoadedChunk[] = [];
  let start = 0;

  while (start < clean.length) {
    const end = Math.min(start + chunkSize, clean.length);
    const piece = clean.slice(start, end).trim();
    if (piece) {
      chunks.push({ content: piece, source });
    }
    if (end === clean.length) {
      break;
    }
    start = end - overlap;
  }

  return chunks;
}

async function extractPdf(buffer: Buffer): Promise<string> {
  // pdf-parse v2 exposes a `PDFParse` class; `getText()` returns the full
  // document text. `destroy()` frees the underlying pdfjs resources.
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text ?? "";
  } finally {
    await parser.destroy();
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function extractExcel(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const parts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // CSV keeps the tabular structure readable for the LLM.
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      parts.push(`Sheet: ${sheetName}\n${csv}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Extracts raw text from a supported file (PDF, DOCX, XLS/XLSX, or plain text)
 * and returns it split into embeddable chunks.
 *
 * @param buffer   The file bytes.
 * @param fileName The original file name (used to detect the type and as source).
 */
export async function loadFile(
  buffer: Buffer,
  fileName: string,
): Promise<LoadedChunk[]> {
  const ext = extname(fileName).toLowerCase();
  const source = basename(fileName);

  let text = "";

  switch (ext) {
    case ".pdf":
      text = await extractPdf(buffer);
      break;
    case ".docx":
    case ".doc":
      text = await extractDocx(buffer);
      break;
    case ".xlsx":
    case ".xls":
    case ".csv":
      text = extractExcel(buffer);
      break;
    case ".txt":
    case ".md":
    case ".text":
      text = buffer.toString("utf-8");
      break;
    default:
      throw new Error(
        `Unsupported file type "${ext}". Supported: .pdf, .docx, .xlsx, .xls, .csv, .txt, .md`,
      );
  }

  return chunkText(text, source);
}

/**
 * Convenience helper to load a file from disk by path.
 */
export async function loadFileFromPath(path: string): Promise<LoadedChunk[]> {
  const buffer = await readFile(path);
  return loadFile(buffer, path);
}
