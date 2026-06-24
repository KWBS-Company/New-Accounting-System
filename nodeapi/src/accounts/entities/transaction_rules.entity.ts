import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { TransactionType } from './transaction_types.entity';
import { Account } from './accounts.entity';

@Entity('transaction_rules')
export class TransactionRule extends BaseEntity {
    @Column({
        type: 'uuid',
        name: 'transaction_type_id',
    })
    transactionTypeId: string;

    @ManyToOne(
        () => TransactionType,
        (transactionType) => transactionType.rules,
        {
            onDelete: 'CASCADE',
        },
    )
    @JoinColumn({ name: 'transaction_type_id' })
    transactionType: TransactionType;

    @Column({
        type: 'uuid',
        name: 'account_id',
    })
    accountId: string;

    @ManyToOne(() => Account, (account) => account.lines)
    @JoinColumn({ name: 'account_id' })
    account: Account;

    @Column({
        type: 'boolean',
        nullable: false,
    })
    increase: boolean;
}
