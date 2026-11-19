import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
    SubscribeMessage, WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { UserService } from 'src/auth/users.service';
import { User } from 'src/auth/entities/user.entity';
import { ChatService } from './chat.service';
import { VoiceService } from './voice.service';

interface VoiceAudioMsg {
    audio: ArrayBuffer;
    mimeType: string;
    chatId?: string;
    model?: string;
    targetLanguage?: string;
}

@WebSocketGateway({
    namespace: '/ai-chat/voice',
    cors: { origin: true, credentials: true },
    maxHttpBufferSize: 25 * 1024 * 1024,
})
export class ChatVoiceGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatVoiceGateway.name);
    private readonly inflight = new Map<string, AbortController>();

    constructor(
        private readonly jwt: JwtService,
        private readonly config: ConfigService,
        private readonly users: UserService,
        private readonly chat: ChatService,
        private readonly voice: VoiceService,
    ) {}

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token as string | undefined;
            if (!token) throw new Error('missing token');
            const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
                secret: this.config.getOrThrow<string>('jwt.secret'),
            });
            const user = await this.users.findById(payload.sub);
            if (!user || !user.isActive || !user.isEmailVerified || user.userRoles.length === 0) {
                throw new Error('user not allowed');
            }
            client.data.user = user;
        } catch (e) {
            this.logger.debug(`Voice socket rejected: ${(e as Error).message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.inflight.get(client.id)?.abort();
        this.inflight.delete(client.id);
    }

    @SubscribeMessage('voice:cancel')
    cancel(@ConnectedSocket() client: Socket) {
        this.inflight.get(client.id)?.abort();
        this.inflight.delete(client.id);
    }

    @SubscribeMessage('voice:audio')
    async onAudio(@ConnectedSocket() client: Socket, @MessageBody() msg: VoiceAudioMsg) {
        const user = client.data.user as User | undefined;
        if (!user) return;
        this.cancel(client); // a new utterance supersedes the running turn
        const controller = new AbortController();
        this.inflight.set(client.id, controller);

        try {
            const ext = msg.mimeType?.includes('pcm') ? 'pcm' : 'wav';
            const { text, language } = await this.voice.transcribe(
                Buffer.from(msg.audio), `utterance.${ext}`, msg.mimeType || 'audio/wav',
            );
            if (controller.signal.aborted) return;
            if (!text.trim()) {
                client.emit('voice:error', { message: "I didn't catch that." });
                return;
            }
            client.emit('voice:transcript', { text, language });

            let meta: { chatId: string; chatTitle: string } | undefined;
            await this.chat.chatVoice(
                user,
                { question: text, chatId: msg.chatId, model: msg.model, language, targetLanguage: msg.targetLanguage },
                controller.signal,
                (e) => {
                    if (controller.signal.aborted) return;
                    if (e.type === 'token') client.emit('voice:token', { text: e.text });
                    else if (e.type === 'audio') client.emit('voice:audio', { sentence: e.sentence, audio: e.audio });
                    else if (e.type === 'meta') meta = { chatId: e.chatId, chatTitle: e.chatTitle };
                    else client.emit('voice:error', { message: e.message });
                },
            );
            if (!controller.signal.aborted && meta) client.emit('voice:done', meta);
        } catch (err) {
            if (controller.signal.aborted) return;
            this.logger.error('Voice turn failed', (err as Error).stack);
            client.emit('voice:error', { message: 'Voice chat is unavailable right now.' });
        } finally {
            if (this.inflight.get(client.id) === controller) this.inflight.delete(client.id);
        }
    }
}
