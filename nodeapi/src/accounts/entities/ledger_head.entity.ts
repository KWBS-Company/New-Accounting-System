import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

import { BaseEntity } from 'src/common/entities/base.entity';
import { LedgerHeadType } from '../types/ledger_head_types.enum';
import { JournalLine } from './journal_lines.entity';
import { AccountKey } from '../services/transaction_rules.service';

@Entity('ledgerheads')
export class LedgerHead extends BaseEntity {
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
    enum: LedgerHeadType,
    enumName: 'ledgerheadtype_enum',
    nullable: false,
  })
  ledgerHeadType: LedgerHeadType;

  @Column({
    type: 'uuid',
    name: 'parent_id',
    nullable: true,
  })
  parentId: string;

  @ManyToOne(
    () => LedgerHead,
    (ledgerHead) => ledgerHead.children
  )
  @JoinColumn({ name: 'parent_id' })
  parent: LedgerHead | null;

  @OneToMany(
    () => LedgerHead,
    (ledgerHead) => ledgerHead.parent
  )
  children: LedgerHead[];

  @OneToMany(
    () => JournalLine,
    (line) => line.ledgerHead,
    {
      cascade: true,
    }
  )
  lines: JournalLine[];

  @Column({
    type: 'enum',
    enum: AccountKey,
    enumName: 'accountkey_enum',
    nullable: false,
  })
  accountKey: AccountKey;
}