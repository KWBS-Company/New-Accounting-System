import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { UserRole } from 'src/auth/entities/user_roles.entity';
import { Account } from 'src/accounts/entities/accounts.entity';
import { TransactionType } from 'src/accounts/entities/transaction_types.entity';
import { Transaction } from 'src/accounts/entities/transactions.entity';

@Entity('customers')
export class Customer extends BaseEntity {

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'company_name', unique: true })
  companyName: string;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'contact_email' })
  companyEmail: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'company_address' })
  companyAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: false, name: 'company_phone' })
  companyPhone: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_website' })
  companyWebsite: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'company_logo' })
  companyLogo: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'pan_number' })
  panNumber: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'vat_number' })
  vatNumber: string;

  @Column({ type: 'timestamp without time zone', nullable: false, name: 'fiscal_start_date', default: 'now' })
  fiscalStartDate: Date;

  @Column({ type: 'timestamp without time zone', nullable: false, name: 'fiscal_end_date', default: () => "(now() + interval '12 months')", })
  fiscalEndDate: Date;

  @Column({ type: 'varchar', length: 3, nullable: false, name: 'transaction_currency_code', default: 'NPR' })
  transactionCurrencyCode: string;

  @OneToMany(() => UserRole, (userRole) => userRole.customer)
  userRoles: UserRole[];

  @OneToMany(() => Account, (account) => account.customer)
  accounts: Account[];

  @OneToMany(() => TransactionType, (account) => account.customer)
  transactionTypes: TransactionType[];

  @OneToMany(() => Transaction, (account) => account.customer)
  transactions: Transaction[];
}
