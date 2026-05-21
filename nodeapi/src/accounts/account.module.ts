import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerHead } from './entities/ledger_head.entity';
import { JournalTransaction } from './entities/journal_transactions.entity';
import { JournalLine } from './entities/journal_lines.entity';

@Module({
    imports: [TypeOrmModule.forFeature([LedgerHead, JournalTransaction, JournalLine])],
    providers: [],
    controllers: [],
    exports: [],
})
export class AccountModule {}