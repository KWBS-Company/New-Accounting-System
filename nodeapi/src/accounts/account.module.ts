import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerHead } from './entities/ledger_head.entity';
import { JournalTransaction } from './entities/journal_transactions.entity';
import { JournalLine } from './entities/journal_lines.entity';
import { LedgerHeadTypesController } from './controllers/ledger_head_types.controller';
import { LedgerHeadController } from './controllers/ledger_head.controller';
import { LedgerHeadService } from './services/ledger_head.service';
import { LedgerHeadRepository } from './repositories/ledger_head.repo';

@Module({
    imports: [TypeOrmModule.forFeature([LedgerHead, JournalTransaction, JournalLine])],
    providers: [LedgerHeadService, LedgerHeadRepository],
    controllers: [LedgerHeadTypesController, LedgerHeadController],
    exports: [],
})
export class AccountModule { }