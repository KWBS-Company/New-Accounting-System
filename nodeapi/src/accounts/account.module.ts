import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerHead } from './entities/ledger_head.entity';
import { JournalTransaction } from './entities/journal_transactions.entity';
import { JournalLine } from './entities/journal_lines.entity';
import { LedgerHeadTypesController } from './controllers/ledger_head_types.controller';
import { LedgerHeadController } from './controllers/ledger_head.controller';
import { LedgerHeadService } from './services/ledger_head.service';
import { LedgerHeadRepository } from './repositories/ledger_head.repo';
import { JournalTransactionRepository } from './repositories/journal_transactions.repo';
import { TransactionService } from './services/journal_transaction.service';
import { TransactionController } from './controllers/journal_transaction.controller';
import { AccountingRuleEngineService } from './services/accounting_rule.service';

@Module({
    imports: [TypeOrmModule.forFeature([LedgerHead, JournalTransaction, JournalLine])],
    providers: [LedgerHeadService, LedgerHeadRepository, JournalTransactionRepository, TransactionService, AccountingRuleEngineService],
    controllers: [LedgerHeadTypesController, LedgerHeadController, TransactionController],
    exports: [],
})
export class AccountModule { }