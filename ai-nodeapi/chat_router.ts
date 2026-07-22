import { Request, Response, Router } from "express";
import { chatService } from "./chat_service.js";
const router = Router();

router.post("/chat", async (req: Request, res: Response) => {
  await chatService.chat(req, res);
});

router.post("/chat/stream", async (req: Request, res: Response) => {
  await chatService.chatStream(req, res);
});


export default router;