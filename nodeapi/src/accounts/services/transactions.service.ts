import {
    BadRequestException,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import { CreateTransactionDto, ListTransactionQuery }
    from "../dto/transactions.dto";

import { Transaction }
    from "../entities/transactions.entity";

import { InjectRepository }
    from "@nestjs/typeorm";

import {
    DataSource,
    IsNull,
    Repository
} from "typeorm";

import { AccountType }
    from "../types/account_types.enum";

import { Account }
    from "../entities/accounts.entity";

import { TransactionType }
    from "../entities/transaction_types.entity";

import { TransactionRule }
    from "../entities/transaction_rules.entity";

import { TransactionLine }
    from "../entities/transaction_lines.entity";
import { PaginatedResponse } from "src/common/dto/pagination.dto";

import * as ExcelJS from 'exceljs';


@Injectable()
export class TransactionService {

    constructor(

        @InjectRepository(Transaction)
        private readonly txnRepository:
            Repository<Transaction>,

        @InjectRepository(TransactionType)
        private readonly txnTypeRepository:
            Repository<TransactionType>,

        @InjectRepository(Account)
        private readonly accountRepository:
            Repository<Account>,

        @InjectRepository(TransactionLine)
        private readonly txnLineRepository:
            Repository<TransactionLine>,

        private readonly dataSource: DataSource,

    ) { }


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

        const {
            account,
            amount,
            increase,
            description,
        } = params;

        let debit = 0;
        let credit = 0;

        const increasesWithDebit =
            this.debitIncreaseTypes.includes(
                account.accountType,
            );

        if (increase) {

            increasesWithDebit
                ? (debit = amount)
                : (credit = amount);

        } else {

            increasesWithDebit
                ? (credit = amount)
                : (debit = amount);
        }

        return {
            account,
            debit,
            credit,
            description,
        };
    }


    // ----------------------------
    // Generate journal lines
    // ----------------------------

    async generateJournalLines(params: {
        rules: TransactionRule[];
        amount: number;
        description?: string;
    }) {

        const {
            rules,
            amount,
            description,
        } = params;

        const lines = await Promise.all(
            rules.map(async (lineRule) => {

                const account =
                    await this.accountRepository.findOne({
                        where: {
                            id: lineRule.accountId,
                            deletedAt: IsNull(),
                        },
                    });

                if (!account) {

                    throw new BadRequestException(
                        'Account not found',
                    );
                }

                return this.buildLine({
                    account,
                    amount,
                    increase: lineRule.increase,
                    description,
                });
            }),
        );

        this.validateBalance(lines);

        return lines;
    }


    // ----------------------------
    // Validate double-entry balance
    // ----------------------------

    validateBalance(lines: any[]): void {

        const totalDebit =
            lines.reduce(
                (sum, l) =>
                    sum + Number(l.debit),
                0,
            );

        const totalCredit =
            lines.reduce(
                (sum, l) =>
                    sum + Number(l.credit),
                0,
            );

        if (
            Math.abs(
                totalDebit - totalCredit,
            ) > 0.001
        ) {

            throw new BadRequestException(
                `Journal entry is not balanced. ` +
                `Total Debit: ${totalDebit}, ` +
                `Total Credit: ${totalCredit}`,
            );
        }
    }


    async save(
        data: Partial<Transaction>,
    ): Promise<Transaction> {

        return this.txnRepository.save(data);
    }


    async create(
        data: CreateTransactionDto,
    ) {

        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;


        await this.dataSource.transaction(
            async (manager) => {

                const newTxn =
                    new Transaction();

                newTxn.reference =
                    reference;

                newTxn.transactionDate =
                    new Date(transactionDate);


                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                            },

                            relations: [
                                'rules',
                            ],
                        },
                    );

                if (!txnType) {

                    throw new BadRequestException(
                        'Transaction type not found',
                    );
                }

                newTxn.transactionType =
                    txnType;


                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(amount),
                        description,
                    });


                await manager.save(
                    Transaction,
                    newTxn,
                );


                for (const line of transactionLines) {

                    const newTxnLine =
                        new TransactionLine();

                    newTxnLine.account =
                        line.account;

                    newTxnLine.credit =
                        line.credit;

                    newTxnLine.debit =
                        line.debit;

                    newTxnLine.transaction =
                        newTxn;

                    newTxnLine.description =
                        description;

                    await manager.save(
                        TransactionLine,
                        newTxnLine,
                    );
                }


                return newTxn;
            },
        );

        return { message: 'Transaction created successfully' }
    }

    async findById(id: string) {
        const data = await this.txnRepository.findOne({ where: { id: id, deletedAt: IsNull() }, relations: ['lines'] });
        if (!data) {
            throw new NotFoundException('Transaction not found');
        }
        return data;
    }

    async delete(
        id: string
    ) {

        await this.dataSource.transaction(
            async (manager) => {

                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!txn) {

                    throw new BadRequestException(
                        'Transaction not found',
                    );
                }

                txn.deletedAt =
                    new Date();


                await manager.save(
                    Transaction,
                    txn,
                );


                for (const line of txn.lines) {
                    line.deletedAt = new Date();

                    await manager.save(
                        TransactionLine,
                        line,
                    );
                }
            },
        );

        return { message: 'Transaction deleted successfully' }
    }


    async listTransactionsWithPagination(query: ListTransactionQuery) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.txnRepository
            .createQueryBuilder('txn')
            .where('txn."deleted_at" IS NULL ')
            .orderBy('txn."created_at"', 'DESC');

        if (query.search) {
            qb.andWhere('( txn."description" ILIKE :search OR rule."reference" ILIKE :search )', { search: `%${query.search}%` })
        }

        qb.skip((page - 1) * pageSize).take(pageSize);

        const [data, total] = await qb.getManyAndCount();
        return new PaginatedResponse(data, total, page, pageSize);
    }


    async update(
        id: string,
        data: CreateTransactionDto,
    ) {

        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;


        await this.dataSource.transaction(
            async (manager) => {


                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!txn) {
                    throw new BadRequestException('Transaction not found to update.');
                }

                txn.reference =
                    reference;

                txn.transactionDate =
                    new Date(transactionDate);


                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                            },

                            relations: [
                                'rules',
                            ],
                        },
                    );

                if (!txnType) {

                    throw new BadRequestException(
                        'Transaction type not found',
                    );
                }

                txn.transactionType =
                    txnType;


                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(amount),
                        description,
                    });


                await manager.save(
                    Transaction,
                    txn,
                );

                for (const line of txn.lines) {

                    line.deletedAt =
                        new Date();

                    await manager.save(
                        TransactionLine,
                        line,
                    );
                }

                for (const line of transactionLines) {

                    const newTxnLine =
                        new TransactionLine();

                    newTxnLine.account =
                        line.account;

                    newTxnLine.credit =
                        line.credit;

                    newTxnLine.debit =
                        line.debit;

                    newTxnLine.transaction =
                        txn;

                    newTxnLine.description =
                        description;

                    await manager.save(
                        TransactionLine,
                        newTxnLine,
                    );
                }
            },
        );

        return { message: 'Transaction updated successfully' }
    }

     // --------------------------------------------------
    // UPLOAD EXCEL
    // --------------------------------------------------

    async uploadExcel(
        file: Express.Multer.File,
    ) {

        if (!file) {
            throw new BadRequestException(
                'File is required',
            );
        }

        const workbook =
            new ExcelJS.Workbook();

        await workbook.xlsx.load(
            file.buffer as any,
        );

        const worksheet =
            workbook.getWorksheet(
                'Transactions',
            );

        if (!worksheet) {
            throw new BadRequestException(
                'Transactions sheet not found',
            );
        }

        const queryRunner =
            this.dataSource.createQueryRunner();

        await queryRunner.connect();

        await queryRunner.startTransaction();

        try {

            // ------------------------------------------
            // LOOP ROWS
            // ------------------------------------------

            for (
                let rowNumber = 2;
                rowNumber <= worksheet.rowCount;
                rowNumber++
            ) {

                const row =
                    worksheet.getRow(
                        rowNumber,
                    );

                const amount =
                    Number(
                        row.getCell(3).value,
                    );

                const transactionTypeName =
                    row.getCell(4).value?.toString()?.trim();

                const transactionDate =
                    row.getCell(5).value?.toString()?.trim();

                const reference =
                    row.getCell(6).value?.toString()?.trim();
                
                const description =
                    row.getCell(7).value?.toString()?.trim();


                // --------------------------------------
                // VALIDATION
                // --------------------------------------

                if (
                    !amount &&
                    !transactionTypeName
                ) {
                    continue;
                }

                if (!amount) {
                    throw new BadRequestException(
                        `Amount missing at row ${rowNumber}`,
                    );
                }

                if (!transactionDate) {
                    throw new BadRequestException(
                        `Transaction date at row ${rowNumber}`,
                    );
                }

                if (!transactionTypeName) {
                    throw new BadRequestException(
                        `Transaction Type missing at row ${rowNumber}`,
                    );
                }


                // --------------------------------------
                // FIND TRANSACTION TYPE
                // --------------------------------------

                const txnType =
                    await queryRunner.manager.findOne(
                        TransactionType,
                        {
                            where: {
                                transactionType:
                                    transactionTypeName,
                                deletedAt: IsNull(),
                            },

                            relations: [
                                'rules',
                                'rules.account',
                            ],
                        },
                    );

                if (!txnType) {
                    throw new BadRequestException(
                        `Transaction type not found at row ${rowNumber}`,
                    );
                }


                // --------------------------------------
                // CREATE TRANSACTION
                // --------------------------------------

                const txn =
                    new Transaction();

                txn.reference =
                    reference || '';


                txn.transactionDate =
                    new Date(transactionDate);

                txn.transactionType =
                    txnType;

                await queryRunner.manager.save(
                    Transaction,
                    txn,
                );


                // --------------------------------------
                // CREATE LINES
                // --------------------------------------

                for (const rule of txnType.rules) {

                    let debit = 0;
                    let credit = 0;

                    const ruleAccount =
                        await queryRunner.manager.findOne(
                            Account,
                            {
                                where: {
                                    id: rule.accountId,
                                },
                            },
                        );

                    if (!ruleAccount) {
                        throw new BadRequestException(
                            `Rule account not found`,
                        );
                    }

                    const debitIncreaseTypes = [
                        'ASSET',
                        'EXPENSE',
                    ];

                    const increasesWithDebit =
                        debitIncreaseTypes.includes(
                            ruleAccount.accountType,
                        );

                    if (rule.increase) {

                        increasesWithDebit
                            ? debit = amount
                            : credit = amount;

                    } else {

                        increasesWithDebit
                            ? credit = amount
                            : debit = amount;
                    }

                    const txnLine =
                        new TransactionLine();

                    txnLine.transaction =
                        txn;

                    txnLine.account =
                        ruleAccount;

                    txnLine.debit =
                        debit;

                    txnLine.credit =
                        credit;

                    txnLine.description =
                        description || '';

                    await queryRunner.manager.save(
                        TransactionLine,
                        txnLine,
                    );
                }
            }

            // ------------------------------------------
            // COMMIT
            // ------------------------------------------

            await queryRunner.commitTransaction();

            return {
                success: true,
                message:
                    'Excel uploaded successfully',
            };

        } catch (error) {

            // ------------------------------------------
            // ROLLBACK
            // ------------------------------------------

            await queryRunner.rollbackTransaction();

            throw error;

        } finally {

            await queryRunner.release();
        }
    }
}