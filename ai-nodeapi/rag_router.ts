import { Request, Response, Router } from "express";
import multer from "multer";
import { ragPipeline } from "./rag_pipeline.js";

// Keep uploaded files in memory; they are parsed and embedded, not stored as-is.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per file
});

const router = Router();

/**
 * Uploads one or more documents (PDF, DOCX, XLSX/XLS/CSV, TXT/MD) into the RAG
 * knowledge base. The text is extracted, chunked, embedded and persisted in
 * Postgres so it becomes retrievable during chat.
 *
 * Send as multipart/form-data with field name "files" (or "file").
 */
router.post(
  "/rag/upload",
  upload.array("files"),
  async (req: Request, res: Response) => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];

      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded. Use multipart/form-data with field "files".',
        });
      }

      const results: Array<{
        file: string;
        success: boolean;
        chunksAdded?: number;
        error?: string;
      }> = [];
      for (const file of files) {
        try {
          const added = await ragPipeline.ingestFile(
            file.buffer,
            file.originalname,
          );
          results.push({
            file: file.originalname,
            chunksAdded: added,
            success: true,
          });
        } catch (err) {
          results.push({
            file: file.originalname,
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }

      return res.json({ success: true, results });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
);

export default router;
