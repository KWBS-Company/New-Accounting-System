import { Customer } from 'src/customer/entities/customer.entity';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ChatConversation } from './chat_conversation.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('chats')
export class Chat extends BaseEntity {
    @Column({ nullable: false, name: 'chat_title', type: 'text' })
    chatTitle: string; 

    @ManyToOne(() => Customer, { nullable: false, onDelete: 'CASCADE' })
    customer: Customer;
    @JoinColumn({ name: 'customer_id' })

    @Column({
        type: 'uuid',
        name: 'customer_id',
        nullable: false
    })
    customerId: string;

    @OneToMany(() => ChatConversation, (chatConversation) => chatConversation.chat, {
        cascade: true,
    })
    conversations: ChatConversation[];
}
