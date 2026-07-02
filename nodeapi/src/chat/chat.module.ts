import { Module } from "@nestjs/common";
import { ChatController } from "./chat.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Chat } from "./entities/chat.entity";
import { ChatConversation } from "./entities/chat_conversation.entity";

@Module({
    imports: [TypeOrmModule.forFeature([Chat, ChatConversation])],
    exports: [],
    providers: [],
    controllers: [ChatController]
})
export class ChatModule {

}