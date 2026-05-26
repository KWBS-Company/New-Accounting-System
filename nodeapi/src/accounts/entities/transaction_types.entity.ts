import {
    Entity,
    Column,
    OneToMany,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { TransactionRule } from './transaction_rules.entity';

@Entity('transaction_types')
export class TransactionType extends BaseEntity {
    @Column({
        type: 'varchar',
        nullable: false,
    })
    name: string;

    @Column({
        type: 'varchar',
        name: 'transaction_type',
        nullable: false,
    })
    transactionType: string

    @OneToMany(
        () => TransactionRule,
        (rule) => rule.transactionType,
        {
            cascade: true,
        }
    )
    rules: TransactionRule[];
}
