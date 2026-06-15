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

import { User } from "src/auth/entities/user.entity";
import { ConfigService } from "@nestjs/config";
import { AccountPDFService } from "./account.pdf.service";
import { AccountExcelService } from "./account.excel.service";
import { JVPdfDataMapper } from "../mapper/pdf.data.mapper";
import { FiscalYearStatus } from "src/customer/types/fiscal_years.status.types";
import { CommonService } from "src/common/utils/common";
import { CustomerFiscalYear } from "src/customer/entities/company.fiscal.entity";

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
        private readonly dataSource: DataSource,
        private readonly configService: ConfigService,
        private readonly accountPdfService: AccountPDFService,
        private readonly accountExcelService: AccountExcelService,
        private readonly commonService: CommonService

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

    private async generateJournalLines(params: {
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

    private validateBalance(lines: any[]): void {

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

    async create(
        data: CreateTransactionDto,
        user: User
    ) {
        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;
        const customerId = user.userRoles[0].customerId;
        await this.transactionGuard(user.userRoles[0].customer.fiscalYears, transactionDate);
        await this.dataSource.transaction(
            async (manager) => {
                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                                customerId: customerId
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

                const transaction = manager.create(Transaction, {
                    reference,
                    customerId,
                    amount: Number(amount),
                    transactionDate: new Date(transactionDate),
                    transactionTypeId: txnType.id
                });

                const retTransaction = await manager.save(Transaction, transaction);

                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(amount),
                        description,
                    });


                for (const line of transactionLines) {

                    const transactionLine = manager.create(TransactionLine, {
                        accountId: line.account.id,
                        credit: line.credit,
                        debit: line.debit,
                        description: description,
                        transactionId: retTransaction.id
                    })

                    await manager.save(
                        TransactionLine,
                        transactionLine,
                    );
                }
            },
        );

        return { message: 'Transaction created successfully' }
    }

    async findById(id: string, user: User) {
        const customerId = user.userRoles[0].customerId;
        const data = await this.txnRepository.findOne({ where: { id: id, deletedAt: IsNull(), customerId: customerId }, relations: ['lines', 'lines.account'] });
        if (!data) {
            throw new NotFoundException('Transaction not found');
        }
        return data;
    }

    async delete(
        id: string,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;

        await this.dataSource.transaction(
            async (manager) => {

                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId: customerId
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


    async listTransactionsWithPagination(
        query: ListTransactionQuery,
        user: User,
    ) {
        const customerId = user.userRoles[0].customerId;
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? 20;

        const qb = this.txnRepository
            .createQueryBuilder('txn')
            .leftJoinAndSelect('txn.transactionType', 'type', 'type.deletedAt IS NULL AND type.customerId = :customerId', { customerId })
            .leftJoinAndSelect('txn.lines', 'line', 'line.deletedAt IS NULL')
            .leftJoinAndSelect('line.account', 'account', 'account.deletedAt IS NULL AND account.customerId = :customerId', { customerId })
            .where(
                'txn.deletedAt IS NULL AND txn.customerId = :customerId',
                { customerId },
            )
            .orderBy('txn.createdAt', 'DESC');

        if (query.search) {
            qb.andWhere(
                `(
                    txn.reference ILIKE :search
                    OR type.name ILIKE :search
                )`,
                {
                    search: `%${query.search}%`,
                },
            );
        }

        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------

        if (query.transactionFrom) {

            qb.andWhere(
                'txn.transaction_date >= :transactionFrom',
                {
                    transactionFrom: query.transactionFrom,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------

        if (query.transactionTo) {

            qb.andWhere(
                'txn.transaction_date <= :transactionTo',
                {
                    transactionTo: query.transactionTo,
                },
            );
        }

        qb.skip((page - 1) * pageSize)
            .take(pageSize);

        const [data, total] = await qb.getManyAndCount();

        return new PaginatedResponse(
            data,
            total,
            page,
            pageSize,
        );
    }


    async update(
        id: string,
        data: CreateTransactionDto,
        user: User
    ) {

        const {
            description,
            reference,
            transactionTypeId,
            amount,
            transactionDate
        } = data;

        const customerId = user.userRoles[0].customerId;

        await this.transactionGuard(user.userRoles[0].customer.fiscalYears, transactionDate);

        await this.dataSource.transaction(
            async (manager) => {
                const txn =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId
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

                txn.amount = Number(amount)

                txn.transactionDate =
                    new Date(transactionDate);


                const txnType =
                    await manager.findOne(
                        TransactionType,
                        {
                            where: {
                                id: transactionTypeId,
                                deletedAt: IsNull(),
                                customerId
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


    async uploadExcel(
        file: Express.Multer.File,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;

        if (!file) {
            throw new BadRequestException(
                'File is required',
            );
        }

        const queryRunner =
            this.dataSource.createQueryRunner();

        await queryRunner.connect();

        await queryRunner.startTransaction();

        try {


            const excelData = await this.accountExcelService.getTransactionTemplateData(file);

            for (const data of excelData) {
                const txnType =
                    await queryRunner.manager.findOne(
                        TransactionType,
                        {
                            where: {
                                transactionType:
                                    data.transactionTypeName,
                                deletedAt: IsNull(),
                                customerId
                            },

                            relations: [
                                'rules',
                                'rules.account',
                            ],
                        },
                    );

                if (!txnType) {
                    throw new BadRequestException(
                        `Transaction type data not found for ${data.transactionTypeName}`,
                    );
                }

                const transaction = queryRunner.manager.create(Transaction, {
                    reference: data.reference ? data.reference : undefined,
                    transactionDate: new Date(data.transactionDate),
                    customerId: customerId,
                    amount: data.amount,
                    transactionTypeId: txnType.id,

                })

                const savedTransaction = await queryRunner.manager.save(
                    Transaction,
                    transaction,
                );

                const transactionLines =
                    await this.generateJournalLines({
                        rules: txnType.rules,
                        amount: Number(data.amount),
                        description: data.description
                    });

                for (const line of transactionLines) {

                    const transactionLine = queryRunner.manager.create(TransactionLine, {
                        accountId: line.account.id,
                        credit: line.credit,
                        debit: line.debit,
                        transactionId: savedTransaction.id,
                        description: data.description

                    });

                    await queryRunner.manager.save(
                        TransactionLine,
                        transactionLine,
                    );
                }
            }

            await queryRunner.commitTransaction();

            return {
                success: true,
                message:
                    'Excel uploaded successfully',
            };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async downloadTransactionTemplate(
        user: User
    ) {

        const customerId = user.userRoles[0].customerId;

        const transactionTypes =
            await this.txnTypeRepository.find({
                where: {
                    deletedAt: IsNull(),
                    customerId
                },
                order: {
                    name: 'ASC',
                },
            });
        return await this.accountExcelService.generateTransactionTemplate(transactionTypes);
    }

    async downloadJournalVoucher(
        transactionId: string,
        user: User
    ) {
        const backendUrl = this.configService.getOrThrow<string>('app.backendUrl')
        const customerId = user.userRoles[0].customerId;
        const txn =
            await this.txnRepository.findOne({
                where: {
                    id: transactionId,
                    deletedAt: IsNull(),
                    customerId
                },
                relations: [
                    'transactionType',
                    'lines',
                    'lines.account',
                ],
            });

        if (!txn) {
            throw new BadRequestException('Transaction not found');
        }

        const pdfMappedData = JVPdfDataMapper(user, backendUrl, txn);

        const pdfBuffer = await this.accountPdfService.journalVoucherPdfGenerator(pdfMappedData);
        return pdfBuffer
    }

    async transactionGuard(fiscalYears: CustomerFiscalYear[], transactionDate: string) {

        const currentFiscalYr = fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set up');
        }

        const isValid = this.commonService.isWithinFiscalYear(new Date(transactionDate), currentFiscalYr.startDate, currentFiscalYr.endDate);

        if (!isValid) {
            throw new BadRequestException(`Transaction cannot be created since the transaction date is beyond current fiscal yr ${currentFiscalYr.name}`);
        }
    }

}