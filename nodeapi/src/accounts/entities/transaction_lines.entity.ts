import { Entity, Column, ManyToOne, JoinColumn, Check } from 'typeorm';

import { Transaction } from './transactions.entity';
import { Account } from './accounts.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('transaction_lines')
@Check(
    'check_debit_credit_rule',
    '(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)',
)
export class TransactionLine extends BaseEntity {
    @Column({
        type: 'uuid',
        name: 'transaction_id',
    })
    transactionId: string;

    @Column({
        type: 'uuid',
        name: 'account_id',
    })
    accountId: string;

    @Column({
        type: 'numeric',
        precision: 15,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number(value),
        },
    })
    debit: number;

    @Column({
        type: 'numeric',
        precision: 15,
        scale: 2,
        default: 0,
        transformer: {
            to: (value: number) => value,
            from: (value: string) => Number(value),
        },
    })
    credit: number;

    @Column({
        type: 'varchar',
        nullable: false,
    })
    description: string;

    @ManyToOne(() => Transaction, (transaction) => transaction.lines, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'transaction_id' })
    transaction: Transaction;

    @ManyToOne(() => Account, (account) => account.lines)
    @JoinColumn({ name: 'account_id' })
    account: Account;
}
