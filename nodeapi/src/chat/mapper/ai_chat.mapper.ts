import { AIChatRequest, AIMessages } from '../dto/ai_chat.dto';
import { ChatDto } from '../dto/chat.dto';
import { ChatConversation } from '../entities/chat_conversation.entity';

export const aiChatRequestMapper = (
    conversation: ChatConversation[],
    chatReq: ChatDto,
): AIChatRequest => {
    const aiMessages: AIMessages[] = [];
    if (conversation.length === 0) {
        aiMessages.push({ role: 'user', content: chatReq.question });
    } else {
        conversation.forEach((c) => {
            aiMessages.push({ role: 'user', content: c.question });
            aiMessages.push({ role: 'assistant', content: c.answer });
        });

        aiMessages.push({ role: 'user', content: chatReq.question });
    }
    return {
        model: chatReq.model,
        messages: aiMessages,
    };
};
