import {
    Entity,
    Column,
    ManyToOne,
    JoinColumn,
    Check,
} from 'typeorm';

import { JournalTransaction } from './journal_transactions.entity';
import { LedgerHead } from './ledger_head.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('journallines')
@Check(
    'check_debit_credit_rule',
    '(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)'
)
export class JournalLine extends BaseEntity {
    @Column({
        type: 'uuid',
        name: 'transaction_id',
    })
    transactionId: string;

    @Column({
        type: 'uuid',
        name: 'ledger_head_id',
    })
    ledgerHeadId: string;

    @Column({
        type: 'numeric',
        precision: 15,
        scale: 2,
        default: 0,
    })
    debit: number;

    @Column({
        type: 'numeric',
        precision: 15,
        scale: 2,
        default: 0,
    })
    credit: number;

    @Column({
        type: 'varchar',
        nullable: true,
    })
    description?: string;

    @ManyToOne(
        () => JournalTransaction,
        (transaction) => transaction.lines,
        {
            onDelete: 'CASCADE',
        }
    )
    @JoinColumn({ name: 'transaction_id' })
    transaction: JournalTransaction;

    @ManyToOne(
        () => LedgerHead,
        (ledgerHead) => ledgerHead.lines
    )
    @JoinColumn({ name: 'ledger_head_id' })
    ledgerHead: LedgerHead;
}
