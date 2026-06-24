import { Entity, Column, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { Customer } from './customer.entity';
import { FiscalYearStatus } from '../types/fiscal_years.status.types';
import { Transaction } from 'src/accounts/entities/transactions.entity';

@Entity('customer_fiscal_years')
export class CustomerFiscalYear extends BaseEntity {
    @Column({ type: 'varchar', length: 255, nullable: false, name: 'name' })
    name: string;

    @Column({ type: 'date', nullable: false, name: 'start_date' })
    startDate: Date;

    @Column({ type: 'date', nullable: false, name: 'end_date' })
    endDate: Date;

    @Column({
        type: 'enum',
        enum: FiscalYearStatus,
        default: FiscalYearStatus.OPEN,
    })
    status: FiscalYearStatus;

    @ManyToOne(() => Customer, (customer) => customer.fiscalYears, {
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

    @OneToMany(() => Transaction, (txn) => txn.fiscalYear, {
        cascade: true,
    })
    transactions: Transaction[];
}
