import { Entity, Column, OneToMany, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { TransactionRule } from './transaction_rules.entity';
import { Customer } from 'src/customer/entities/customer.entity';

@Entity('transaction_types')
export class TransactionType extends BaseEntity {
    @Column({
        type: 'varchar',
        nullable: false,
    })
    name: string;

    @Column({
        type: 'varchar',
        nullable: false,
    })
    description: string;

    @Column({
        type: 'varchar',
        name: 'transaction_type',
        nullable: false,
    })
    transactionType: string;

    @OneToMany(() => TransactionRule, (rule) => rule.transactionType, {
        cascade: true,
    })
    rules: TransactionRule[];

    @ManyToOne(() => Customer, (customer) => customer.transactionTypes, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({
        type: 'uuid',
        name: 'customer_id',
        nullable: false,
    })
    customerId: string;
}
