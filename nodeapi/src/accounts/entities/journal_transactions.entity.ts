import {
    Entity,
    Column,
    OneToMany,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { JournalLine } from './journal_lines.entity';

@Entity('journaltransactions')
export class JournalTransaction extends BaseEntity {
    @Column({
        type: 'uuid',
        unique: true,
        generated: 'uuid',
    })
    uuid: string;

    @Column({
        type: 'varchar',
        length: 100,
        nullable: true,
    })
    reference?: string;

    @Column({
        type: 'text',
        nullable: true,
    })
    description?: string;

    @Column({
        type: 'timestamptz',
        name: 'transaction_date',
        default: () => 'CURRENT_TIMESTAMP',
        nullable: false,
    })
    transactionDate: Date;

    @OneToMany(
        () => JournalLine,
        (line) => line.transaction,
        {
            cascade: true,
        }
    )
    lines: JournalLine[];
}