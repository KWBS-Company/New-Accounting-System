import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Chat } from './entities/chat.entity';
import { ChatConversation } from './entities/chat_conversation.entity';
import { ChatService } from './chat.service';
import { VoiceService } from './voice.service';
import { ChatVoiceGateway } from './chat.gateway';
import { AuthModule } from 'src/auth/auth.module';

@Module({
    imports: [TypeOrmModule.forFeature([Chat, ChatConversation]), AuthModule],
    exports: [],
    providers: [ChatService, VoiceService, ChatVoiceGateway],
    controllers: [ChatController],
})
export class ChatModule {}
