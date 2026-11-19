import {
    Body,
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Patch,
    Post,
    Res,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { User } from 'src/auth/entities/user.entity';
import { ChatService } from './chat.service';
import { ChatDto, ChatTitleDto } from './dto/chat.dto';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, memoryStorage } from 'multer';
import { VoiceService } from './voice.service';

@Controller('ai-chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly voiceService: VoiceService,
    ) {}

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

    @ApiBearerAuth('accessToken')
    @Get('all/models')
    async listModels() {
        return this.chatService.listModels();
    }

    @ApiBearerAuth('accessToken')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    @Post('voice/transcribe')
    async transcribeVoice(@UploadedFile() file: Express.Multer.File) {
        if (!file) throw new HttpException('file is required', HttpStatus.BAD_REQUEST);
        try {
            return await this.voiceService.transcribe(file.buffer, file.originalname, file.mimetype);
        } catch {
            throw new HttpException('Voice service unavailable', HttpStatus.BAD_GATEWAY);
        }
    }

    @ApiBearerAuth('accessToken')
    @Post('voice/speak')
    async speak(@Body() body: { text: string; language?: string }, @Res() res: Response) {
        if (!body?.text?.trim()) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: 'text is required' });
        }
        try {
            const wav = await this.voiceService.speak(body.text, body.language);
            if (!wav) return res.status(HttpStatus.NO_CONTENT).end();
            res.setHeader('Content-Type', 'audio/wav');
            return res.send(wav);
        } catch {
            return res.status(HttpStatus.BAD_GATEWAY).json({ message: 'Voice service unavailable' });
        }
    }

    @UseInterceptors(
        FileInterceptor('file', {
            storage: diskStorage({
                destination: './uploads/docs',
                filename: (req, file, cb) => {
                    cb(null, file.originalname);
                },
            }),
        }),
    )
    @Post('upload')
    @ApiConsumes('multipart/form-data') // <— tells Swagger it's multipart
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                file: { type: 'string', format: 'binary' },
            },
            required: ['file'],
        },
    })
    uploadDocs(@UploadedFile() file: Express.Multer.File) {
        return this.chatService.uploadDocs(file);
    }
}
