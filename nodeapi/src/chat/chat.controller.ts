import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Res,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatDto, ChatTitleDto } from './dto/chat.dto';
import { Response } from 'express';

@Controller('ai-chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @ApiBearerAuth('accessToken')
    @Post()
    async chat(
        @Body() chatRequest: ChatDto,
        @CurrentUser() user: User,
        @Res() res: Response,
    ) {
        return await this.chatService.chat(res, user, chatRequest);
    }

    @ApiBearerAuth('accessToken')
    @Get()
    async chatList(@CurrentUser() user: User) {
        return this.chatService.getChatList(user);
    }

    @ApiBearerAuth('accessToken')
    @Get(':id')
    async getChat(@CurrentUser() user: User, @Param('id') chatId: string) {
        return this.chatService.getChatDetail(user, chatId);
    }

    @ApiBearerAuth('accessToken')
    @Patch('title')
    async upsertChatTitle(
        @Body() chatRequest: ChatTitleDto,
        @CurrentUser() user: User,
    ) {
        await this.chatService.updateChatTitle(user, chatRequest);
        return { message: 'Chat title is updated successfully' };
    }

    @ApiBearerAuth('accessToken')
    @Delete(':id')
    async delete(@Param('id') chatId: string, @CurrentUser() user: User) {
        return this.chatService.deleteChat(user, chatId);
    }
}
