import { BadRequestException, Injectable } from "@nestjs/common";
import { CreateTransactionDto } from "../dto/transactions.dto";
import { Transaction } from "../entities/transactions.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import { AccountType } from "../types/account_types.enum";
import { Account } from "../entities/accounts.entity";
import { TransactionType } from "../entities/transaction_types.entity";
import { TransactionRule } from "../entities/transaction_rules.entity";

@Injectable()
export class TransactionService {
    constructor(@InjectRepository(Transaction)
    private readonly txnRepository: Repository<Transaction>,
        @InjectRepository(TransactionType)
        private readonly txnTypeRepository: Repository<TransactionType>,
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>
    ) {

    }

    // ----------------------------
    // Account type → normal side
    // ----------------------------

    private readonly debitIncreaseTypes = [
        AccountType.ASSET,
        AccountType.EXPENSE,
    ];

    // ----------------------------
    // Build a single journal line
    // ----------------------------

    private buildLine(params: {
        account: Account;
        amount: number;
        increase: boolean;
        description?: string;
    }) {

        const { account, amount, increase, description } = params;

        let debit = 0;
        let credit = 0;

        const increasesWithDebit = this.debitIncreaseTypes.includes(account.accountType);

        if (increase) {
            increasesWithDebit ? (debit = amount) : (credit = amount);
        } else {
            increasesWithDebit ? (credit = amount) : (debit = amount);
        }

        return {
            accountId: account.id,
            accountCode: account.code,
            debit,
            credit,
            description,
        };
    }

    // ----------------------------
    // Generate journal lines
    // from transaction type + accounts map
    // ----------------------------

    async generateJournalLines(params: {
        rules: TransactionRule[];
        amount: number;
        description?: string;
    }) {

        const { rules, amount, description } = params;

        // Build each line from the rule
        const lines = await Promise.all(rules.map(async (lineRule) => {
            const account = await this.accountRepository.findOne({ where: { id: lineRule.accountId, deletedAt: IsNull() } });

            if (!account) {
                throw new BadRequestException(
                    'Account not found'
                );
            }

            return this.buildLine({
                account,
                amount,
                increase: lineRule.increase,
                description,
            });
        }));

        // Validate before returning
        this.validateBalance(lines);

        return lines;
    }

    // ----------------------------
    // Validate double-entry balance
    // ----------------------------

    validateBalance(lines: any[]): void {
        const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit), 0);
        const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.001) {
            throw new BadRequestException(
                `Journal entry is not balanced. ` +
                `Total Debit: ${totalDebit}, Total Credit: ${totalCredit}`,
            );
        }
    }


    async save(data: Partial<Transaction>): Promise<Transaction> {
        return this.txnRepository.save(data);
    }

    async create(data: CreateTransactionDto) {
        const { description, reference, transactionTypeId, amount } = data;

        const newTxn = new Transaction();
        newTxn.reference = reference;
        newTxn.description = description || '';
        newTxn.transactionDate = new Date();

        const txnType = await this.txnTypeRepository.findOne({ where: { id: transactionTypeId, deletedAt: IsNull() }, relations: ['rules'] });

        if (!txnType) {
            throw new BadRequestException('Transaction type not found')
        }

        newTxn.transactionType = txnType;

        const transaction = await this.generateJournalLines({ rules: txnType.rules, amount: Number(amount), description });

        // await this.journalTxnRepository.save(newJournalTxn);

        return transaction


    }
}