import { Request, Response, Router } from "express";
import multer from "multer";
import { voiceService } from "./voice_service.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/voice/transcribe", upload.single("file"), (req: Request, res: Response) => voiceService.transcribe(req, res));
router.post("/voice/speak", (req: Request, res: Response) => voiceService.speak(req, res));
router.post("/voice/chat/stream", (req: Request, res: Response) => voiceService.chatStream(req, res));

export default router;
