import { Injectable } from "@nestjs/common";
import { CreateTransactionDto } from "../dto/transactions.dto";
import { Transaction } from "../entities/transactions.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

@Injectable()
export class TransactionService {
    constructor(@InjectRepository(Transaction)
    private readonly txnRepository: Repository<Transaction>,
    ) {

    }

    async save(data: Partial<Transaction>): Promise<Transaction> {
        return this.txnRepository.save(data);
    }

    // async create(data: CreateTransactionDto) {
    //     const { description, reference, transactionType, amount } = data;

    //     const newJournalTxn = new JournalTransaction();
    //     newJournalTxn.reference = reference;
    //     newJournalTxn.description = description || '';
    //     newJournalTxn.transactionDate = new Date();
    //     newJournalTxn.transactionType = transactionType;

    //     const transaction = await this.accountingRuleService.generateJournalLines({ transactionType, amount: Number(amount), description });

    //     // await this.journalTxnRepository.save(newJournalTxn);

    //     return transaction


    // }
}