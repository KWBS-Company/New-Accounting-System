import {
    Entity,
    Column,
    OneToMany,
    ManyToOne,
    JoinColumn,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import {TransactionLine } from './transaction_lines.entity';
import { TransactionType } from './transaction_types.entity';

@Entity('transactions')
export class Transaction extends BaseEntity {
    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
    })
    reference?: string;

    @Column({
        type: 'timestamptz',
        name: 'transaction_date',
        default: () => 'CURRENT_TIMESTAMP',
        nullable: false,
    })
    transactionDate: Date;

    @OneToMany(
        () => TransactionLine,
        (line) => line.transaction,
        {
            cascade: true,
        }
    )
    lines: TransactionLine[];

    @Column({
        type: 'uuid',
        name: 'transaction_type_id',
    })
    transactionTypeId: string;

    @ManyToOne(
        () => TransactionType,
        (transactionType) => transactionType.rules
    )
    @JoinColumn({ name: 'transaction_type_id' })
    transactionType: TransactionType;
}