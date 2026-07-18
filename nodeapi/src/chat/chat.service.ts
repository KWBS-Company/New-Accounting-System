import {
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';
import { createReadStream } from 'fs';
import { Response } from 'express';
import axios from 'axios';
import FormData from 'form-data';
import { ChatDto, ChatTitleDto } from './dto/chat.dto';
import { Chat } from './entities/chat.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatConversation } from './entities/chat_conversation.entity';
import { User } from 'src/auth/entities/user.entity';
import { AIChatRequest } from './dto/ai_chat.dto';
import { aiChatRequestMapper } from './mapper/ai_chat.mapper';
interface OllamaStreamChunk {
    model: string;
    message: {
        role: string;
        content: string;
    };
    done: boolean;
}

@Injectable()
export class ChatService {
    private static aiEndpointBaseUrl: string = 'http://localhost:2050';
    private logger = new Logger(ChatService.name);

    constructor(
        private readonly configService: ConfigService,
        @InjectRepository(Chat)
        private readonly chatRepository: Repository<Chat>,
        @InjectRepository(ChatConversation)
        private readonly chatConversationRepository: Repository<ChatConversation>,
    ) { }

    async getChatInfo(currentUser: User, chatDto: ChatDto) {
        const { chatId } = chatDto;
        const customerId = currentUser.userRoles[0].customerId;

        const chatInfo = chatId
            ? await this.chatRepository.findOneBy({
                id: chatDto.chatId,
                deletedAt: IsNull(),
                customerId,
            })
            : new Chat();

        if (chatInfo) {
            if (!chatId) {
                chatInfo.customerId = customerId;
                chatInfo.chatTitle = 'New Chat'; // Placeholder for AI-generated title
            }
            return chatInfo;
        } else {
            throw new HttpException(
                'No chat history was found for this chat ID. It might have already been deleted.',
                HttpStatus.NOT_FOUND,
            );
        }
    }

    private async aiChatEndpoint(chatReq: AIChatRequest) {
        const response = await axios.post<Readable>(
            `${ChatService.aiEndpointBaseUrl}/api/chat/stream`,
            chatReq,
            {
                responseType: 'stream',
            },
        );
        return response.data;
    }

    async chat(res: Response, user: User, chatRequest: ChatDto) {
        const { question, chatId } = chatRequest;

        const chatInfo = await this.getChatInfo(user, chatRequest);

        const conversations = await this.chatConversationRepository.find({
            where: { deletedAt: IsNull(), chatId: chatId },
        });

        const chatReq = aiChatRequestMapper(conversations, chatRequest, user);

        // Helper to prevent "write after end" errors
        const safeWrite = (payload: Record<string, unknown>) => {
            if (!res.writableEnded && !res.destroyed) {
                res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }
        };

        const safeEnd = () => {
            if (!res.writableEnded && !res.destroyed) {
                res.end();
            }
        };

        try {
            const stream = await this.aiChatEndpoint(chatReq);

            if (!stream) {
                throw new Error('AI endpoint returned null stream');
            }

            let answer = '';
            let buffer = '';

            stream.on('data', (chunk: Buffer) => {
                if (!Buffer.isBuffer(chunk)) {
                    this.logger.warn('Received non-Buffer data chunk');
                    return;
                }

                buffer += chunk.toString('utf8');
                const lines = buffer.split('\n');

                // Keep the last incomplete line in buffer
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim().replace('data:', '');
                    if (!trimmedLine) continue;

                    try {
                        const parsed = JSON.parse(
                            trimmedLine,
                        ) as OllamaStreamChunk;

                        // Extract token content
                        const content = parsed.message?.content;
                        if (content && typeof content === 'string') {
                            answer += content;
                            safeWrite({ text: content });
                        }

                        // Check if stream is complete
                        if (parsed.done) {
                            this.logger.log(
                                `Stream complete.`,
                            );
                        }
                    } catch (parseErr) {
                        // Incomplete or malformed JSON line, skip
                        this.logger.debug(
                            `Skipped invalid JSON line: ${(parseErr as Error).message}`,
                        );
                    }
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            stream.on('end', async () => {
                this.logger.log(
                    `Chat stream ended. Answer length: ${answer.length}`,
                );
                try {
                    const chatConversation = new ChatConversation();
                    chatConversation.chat = chatInfo;
                    chatConversation.question = question;
                    chatConversation.answer = answer;

                    const chat = await this.chatRepository.save(chatInfo);
                    await this.chatConversationRepository.save(
                        chatConversation,
                    );

                    safeWrite({
                        type: 'meta',
                        chatId: chat.id,
                        chatTitle: chat.chatTitle,
                    });
                    safeEnd();
                } catch (dbErr) {
                    this.logger.error(
                        'Failed to persist chat conversation',
                        dbErr,
                    );
                    safeWrite({
                        error: 'Failed to save conversation to database',
                    });
                    safeEnd();
                }
            });

            stream.on('error', (err) => {
                this.logger.error('AI stream encountered error', {
                    message: err.message,
                    stack: err.stack,
                });
                safeWrite({ error: 'Stream interrupted' });
                safeEnd();
            });
        } catch (error: unknown) {
            const errorMsg =
                'We encountered an issue while processing your chat. Please try again later.';

            if (axios.isAxiosError(error)) {
                const jsonString = JSON.stringify(chatReq);
                this.logger.error(jsonString);
                const bytes = Buffer.byteLength(jsonString, 'utf8');
                const mb = bytes / (1024 * 1024);
                this.logger.error(
                    `AI Chat Error. Payload size: ${mb.toFixed(4)} MB`,
                    error.response?.data,
                );
            } else if (error instanceof Error) {
                this.logger.error(`Backend error: ${error.message}`, {
                    stack: error.stack,
                });
            } else {
                this.logger.error('Unknown Error:', error);
            }

            safeWrite({ error: errorMsg });
            safeEnd();
        }
    }

    async updateChatTitle(user: User, chatTitleReq: ChatTitleDto) {
        const { title, chatId } = chatTitleReq;
        const customerId = user.userRoles[0].customerId;
        if (chatId) {
            if (title) {
                const chatInfo = await this.chatRepository.findOneBy({
                    id: chatId,
                    deletedAt: IsNull(),
                    customerId,
                });
                if (chatInfo) {
                    chatInfo.chatTitle = title;
                    return await this.chatRepository.save(chatInfo);
                } else {
                    throw new HttpException(
                        `We couldn't find the chat you're looking for. Please verify the chat ID and try again.`,
                        HttpStatus.BAD_REQUEST,
                    );
                }
            }
        } else {
            throw new HttpException(
                `Chat not found. Please check the chat ID and try again.`,
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async deleteChat(user: User, chatId: string) {
        const customerId = user.userRoles[0].customerId;
        if (chatId) {
            try {
                const chatInfo = await this.chatRepository.findOne({
                    where: {
                        id: chatId,
                        deletedAt: IsNull(),
                        customerId,
                    },
                    relations: ['conversations'],
                });
                if (!chatInfo) {
                    throw new HttpException(
                        'Chat not found. Please verify the chat ID.',
                        HttpStatus.BAD_REQUEST,
                    );
                }
                chatInfo.deletedAt = new Date();
                await this.chatRepository.save(chatInfo);

                for (const c of chatInfo.conversations) {
                    c.deletedAt = new Date();
                    await this.chatConversationRepository.save(c);
                }
                return { message: `Chat has been deleted successfully.` };
            } catch (error) {
                this.logger.error(error);
                throw new HttpException(
                    'There was an issue deleting the chat. Please try again or contact support if the problem continues.',
                    HttpStatus.BAD_REQUEST,
                );
            }
        } else {
            throw new HttpException(
                'Please provide a chat ID to proceed with deletion.',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    async getChatDetail(user: User, chatId: string) {
        const customerId = user.userRoles[0].customerId;
        const chat = await this.chatRepository.findOne({
            where: {
                id: chatId,
                deletedAt: IsNull(),
                customerId,
            },
            relations: ['conversations'],
        });

        if (!chat) {
            throw new NotFoundException(
                'Chat you are searching is not found in the database.',
            );
        }
        return chat;
    }

    async getChatList(user: User) {
        const customerId = user.userRoles[0].customerId;

        return await this.chatRepository.find({
            where: { deletedAt: IsNull(), customerId },
        });
    }

    async listModels() {
        const res = await axios.get<{ name: string }>(
            `${ChatService.aiEndpointBaseUrl}/api/models`,
        );

        return res.data;
    }

    private async ragUpload(file: Express.Multer.File) {
        const form = new FormData();
        // The ai-nodeapi RAG endpoint expects the multipart field name "files".
        form.append('files', createReadStream(file.path), {
            filename: file.originalname,
            contentType: file.mimetype,
        });

        const response = await axios.post<{
            success: boolean;
            results?: Array<{
                file: string;
                success: boolean;
                chunksAdded?: number;
                error?: string;
            }>;
            error?: string;
        }>(`${ChatService.aiEndpointBaseUrl}/api/rag/upload`, form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        return response.data;
    }

    async uploadDocs(file: Express.Multer.File) {
        const backendUrl =
            this.configService.getOrThrow<string>('app.backendUrl');

        // Forward the uploaded document to the AI RAG pipeline so its content is
        // extracted, embedded and made retrievable during chat.
        let rag: {
            success: boolean;
            results?: Array<{
                file: string;
                success: boolean;
                chunksAdded?: number;
                error?: string;
            }>;
            error?: string;
        };
        try {
            rag = await this.ragUpload(file);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                this.logger.error(
                    'Failed to ingest document into RAG pipeline',
                    error.response?.data,
                );
            } else {
                this.logger.error(
                    'Failed to ingest document into RAG pipeline',
                    error,
                );
            }
            throw new HttpException(
                'The document was uploaded but could not be processed for AI search. Please try again later.',
                HttpStatus.BAD_GATEWAY,
            );
        }

        return {
            message: `Docs uploaded successfully`,
            docUrl: `${backendUrl}/uploads/docs/${file.originalname}`,
            rag,
        };
    }
}
