import { Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ChatDto } from "./chat.dto.js";
import { getAgent } from "./agent_workflow.js";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { UserInfoDto } from "./chat.dto.js";

class ChatService {

    constructor() {

    }

    // Build a system message describing the current user so the assistant can
    // answer questions about the user's own profile (name, email, company, etc.).
    private buildUserInfoMessage(userInfo: UserInfoDto): { role: string; content: string } {
        const lines = [
            "Here is information about the current user you are chatting with.",
            "Use it to answer any questions the user asks about their own profile or account,",
            "and to provide the correct customer context for accounting operations.",
            `- Full name: ${userInfo.fullName}`,
            `- Email: ${userInfo.email}`,
            `- Company name: ${userInfo.companyName}`,
            // `- Company ID: ${userInfo.companyId}`,
        ];
        // if (userInfo.customerId) {
        //     lines.push(`- Customer ID: ${userInfo.customerId}`);
        // }
        return { role: "system", content: lines.join("\n") };
    }
    async chat(req: Request, res: Response) {
        try {
            const dto = plainToInstance(ChatDto, req.body);

            const errors = await validate(dto, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    errors,
                });
            }

            const { messages, userInfo } = dto;

            const customerId = userInfo.customerId ?? userInfo.companyId;

            const agent = await getAgent(customerId);

            const userInfoMessage = this.buildUserInfoMessage(userInfo);

            const result = await agent.invoke({
                messages: [
                    userInfoMessage,
                    ...messages.map((m) => ({
                        role: m.role,
                        content: m.content,
                    })),
                ],
            });

            const roleMap: Record<string, string> = {
                human: "user",
                ai: "assistant",
                system: "system",
                tool: "tool",
            };
            const history = (result.messages ?? []).map((m: BaseMessage) => {
                const type = m.type;
                const aiMessage = m instanceof AIMessage ? (m as AIMessage) : undefined;
                const toolCalls = aiMessage?.tool_calls?.length
                    ? { toolCalls: aiMessage.tool_calls }
                    : {};
                return {
                    role: roleMap[type] ?? type,
                    content: m.text,
                    ...toolCalls,
                };
            });

            const lastAiMessage = [...history].reverse().find(
                (m) => m.role === "assistant" && m.content.trim().length > 0
            );

            return res.json({
                success: true,
                reply: lastAiMessage?.content ?? "",
                history:history
            });

        } catch (err) {
            console.error(err);

            return res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : "Unknown error",
            });
        }
    }

    async chatStream(req: Request, res: Response) {
        try {
            const dto = plainToInstance(ChatDto, req.body);

            const errors = await validate(dto, {
                whitelist: true,
                forbidNonWhitelisted: true,
            });

            if (errors.length > 0) {
                return res.status(400).json({
                    success: false,
                    errors,
                });
            }

            const { messages, userInfo } = dto;

            const customerId = userInfo.customerId ?? userInfo.companyId;

            const agent = await getAgent(customerId);

            // Set up Server-Sent Events (SSE) so the client receives the reply
            // token-by-token as the model generates it.
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache, no-transform");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders?.();

            const send = (event: string, data: unknown) => {
                res.write(`event: ${event}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            };

            // Stop streaming if the client disconnects.
            let aborted = false;
            req.on("close", () => {
                aborted = true;
            });

            let fullReply = "";

            // `streamMode: "messages"` yields [messageChunk, metadata] tuples,
            // where messageChunk carries the incremental LLM output.
            const userInfoMessage = this.buildUserInfoMessage(userInfo);

            const stream = await agent.stream(
                {
                    messages: [
                        userInfoMessage,
                        ...messages.map((m) => ({
                            role: m.role,
                            content: m.content,
                        })),
                    ],
                },
                { streamMode: "messages" },
            );

            for await (const chunk of stream) {
                if (aborted) break;

                const [message] = chunk as [BaseMessage, Record<string, unknown>];
                const type = message.type;

                // Only stream assistant/LLM token chunks to the client.
                if (type !== "ai" && type !== "AIMessageChunk") continue;

                const content = message.text;

                if (content) {
                    fullReply += content;
                    send("token", { content });
                }
            }

            if (!aborted) {
                send("done", { reply: fullReply });
                res.end();
            }
        } catch (err) {
            console.error(err);

            if (res.headersSent) {
                res.write(`event: error\n`);
                res.write(
                    `data: ${JSON.stringify({
                        error: err instanceof Error ? err.message : "Unknown error",
                    })}\n\n`,
                );
                return res.end();
            }

            return res.status(500).json({
                success: false,
                error: err instanceof Error ? err.message : "Unknown error",
            });
        }
    }
}

export const chatService = new ChatService();