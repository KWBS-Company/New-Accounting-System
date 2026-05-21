import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerHead } from './entities/ledger_head.entity';
import { JournalTransaction } from './entities/journal_transactions.entity';
import { JournalLine } from './entities/journal_lines.entity';
import { LedgerHeadTypesController } from './controllers/ledger_head_types.controller';

@Module({
    imports: [TypeOrmModule.forFeature([LedgerHead, JournalTransaction, JournalLine])],
    providers: [],
    controllers: [LedgerHeadTypesController],
    exports: [],
})
export class AccountModule {}