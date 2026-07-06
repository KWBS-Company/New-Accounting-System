import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Chat } from './chat.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('chat_conversations')
export class ChatConversation extends BaseEntity {
    @ManyToOne(() => Chat, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'chat_id' })
    chat: Chat;

    @Column({
        type: 'uuid',
        name: 'chat_id',
        nullable: false,
    })
    chatId: string;

    @Column({ nullable: false, type: 'text' })
    question: string;

    @Column({ nullable: false, type: 'text' })
    answer: string;

    @Column({ nullable: false, type: 'boolean', default: false })
    like: boolean;

    @Column({ nullable: false, type: 'boolean', default: false })
    dislike: boolean;
}
