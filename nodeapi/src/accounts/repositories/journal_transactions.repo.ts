import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JournalTransaction } from '../entities/journal_transactions.entity';

@Injectable()
export class JournalTransactionRepository {
    constructor(
        @InjectRepository(JournalTransaction)
        private readonly journalTxnRepository: Repository<JournalTransaction>,
    ) { }

    async save(data: Partial<JournalTransaction>): Promise<JournalTransaction> {
        return this.journalTxnRepository.save(data);
    }
}
