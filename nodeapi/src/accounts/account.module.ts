import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionLine } from './entities/transaction_lines.entity';
import { AccountTypeController } from './controllers/account_types.controller';
import { AccountController } from './controllers/accounts.controller';
import { TransactionService } from './services/transactions.service';
import { TransactionController } from './controllers/transactions.controller';
import { Transaction } from './entities/transactions.entity';
import { TransactionType } from './entities/transaction_types.entity';
import { TransactionRule } from './entities/transaction_rules.entity';
import { Account } from './entities/accounts.entity';
import { AccountService } from './services/accounts.service';
import { TransactionRuleController } from './controllers/transaction_rules.controller';
import { TransactionRuleService } from './services/transaction_rules.service';

@Module({
    imports: [TypeOrmModule.forFeature([Account, Transaction, TransactionLine, TransactionType, TransactionRule])],
    providers: [AccountService, TransactionService, TransactionRuleService],
    controllers: [AccountTypeController, AccountController, TransactionController, TransactionRuleController],
    exports: [],
})
export class AccountModule { }