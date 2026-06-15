import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { AccountType } from '../types/account_types.enum';
import { TransactionLine } from './transaction_lines.entity';
import { Customer } from 'src/customer/entities/customer.entity';

@Entity('accounts')
export class Account extends BaseEntity {
  @Column({
    type: 'varchar',
    nullable: false,
  })
  name: string;

  @Column({
    type: 'varchar',
    nullable: false,
  })
  code: string;

  @Column({
    type: 'enum',
    enum: AccountType,
    enumName: 'accounttype_enum',
    nullable: false,
  })
  accountType: AccountType;

  @Column({
    type: 'uuid',
    name: 'parent_id',
    nullable: true,
  })
  parentId: string | null;

  @ManyToOne(
    () => Account,
    (account) => account.children
  )
  @JoinColumn({ name: 'parent_id' })
  parent: Account | null;

  @OneToMany(
    () => Account,
    (account) => account.parent
  )
  children: Account[];

  @OneToMany(
    () => TransactionLine,
    (line) => line.account,
    {
      cascade: true,
    }
  )
  lines: TransactionLine[];

  @ManyToOne(() => Customer, (customer) => customer.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({
    type: 'uuid',
    name: 'customer_id',
    nullable: false,
  })
  customerId: string;

}