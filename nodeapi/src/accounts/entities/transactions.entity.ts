import {
    Entity,
    Column,
    OneToMany,
    ManyToOne,
    JoinColumn,
    Generated,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { TransactionLine } from './transaction_lines.entity';
import { Customer } from 'src/customer/entities/customer.entity';
import { CustomerFiscalYear } from 'src/customer/entities/company.fiscal.entity';

@Entity('transactions')
export class Transaction extends BaseEntity {

    @Column({ type: 'integer', unique: true, name: 'serial_number' })
    @Generated('increment')
    serialNumber: number;


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


    @ManyToOne(() => Customer, (customer) => customer.transactions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({
        type: 'uuid',
        name: 'customer_id',
        nullable: false,
    })
    customerId: string;

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
    amount: number;

    @ManyToOne(() => CustomerFiscalYear, (fiscalYear) => fiscalYear.transactions, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'fiscal_year_id' })
    fiscalYear: CustomerFiscalYear;

    @Column({
        type: 'uuid',
        name: 'fiscal_year_id',
        nullable: false,
    })
    fiscalYearId: string;
}