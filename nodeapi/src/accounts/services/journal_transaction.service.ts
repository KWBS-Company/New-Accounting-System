import { Injectable } from "@nestjs/common";
import { JournalTransactionRepository } from "../repositories/journal_transactions.repo";
import { AccountingRuleEngineService } from "./accounting_rule.service";
import { CreateTransactionDto } from "../dto/transaction.dto";
import { JournalTransaction } from "../entities/journal_transactions.entity";

@Injectable()
export class TransactionService {
    constructor(private readonly journalTxnRepository: JournalTransactionRepository,
        private readonly accountingRuleService: AccountingRuleEngineService
    ) {

    }

    async create(data: CreateTransactionDto) {
        const { description, reference, transactionType, amount } = data;

        const newJournalTxn = new JournalTransaction();
        newJournalTxn.reference = reference;
        newJournalTxn.description = description || '';
        newJournalTxn.transactionDate = new Date();
        newJournalTxn.transactionType = transactionType;

        const transaction = await this.accountingRuleService.generateJournalLines({ transactionType, amount: Number(amount), description });

        // await this.journalTxnRepository.save(newJournalTxn);

        return transaction


    }
}