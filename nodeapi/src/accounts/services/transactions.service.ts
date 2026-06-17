import {
    BadRequestException,
    Injectable,
    NotFoundException
} from "@nestjs/common";

import { CreateTransactionDto, ListTransactionQuery, PreviewTransactionLineDto, UpdateTransactionDto }
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

    private readonly debitIncreaseTypes = [AccountType.ASSET, AccountType.EXPENSE];

    private buildLine(params: {
        account: Account;
        amount: number;
        increase: boolean;
        description?: string;
    }) {

        const { account, amount, increase, description } = params;

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
            accountId: account.id,
        };
    }

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

    async create(
        data: CreateTransactionDto,
        user: User
    ) {
        const {
            reference,
            amount,
            lines,
            transactionDate
        } = data;
        const customerId = user.userRoles[0].customerId;
        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }
        const isValid = this.commonService.isWithinFiscalYear(new Date(transactionDate), currentFiscalYr.startDate, currentFiscalYr.endDate);

        if (!isValid) {
            throw new BadRequestException(`Transaction cannot be created since the transaction date is beyond current fiscal yr ${currentFiscalYr.name}`);
        }
        this.validateBalance(lines)
        await this.dataSource.transaction(
            async (manager) => {

                const transaction = manager.create(Transaction, {
                    reference,
                    customerId,
                    amount: amount,
                    fiscalYearId: currentFiscalYr.id,
                    transactionDate: new Date(transactionDate),
                });

                const retTransaction = await manager.save(Transaction, transaction);

                for (const line of lines) {

                    const transactionLine = manager.create(TransactionLine, {
                        accountId: line.accountId,
                        credit: line.credit,
                        debit: line.debit,
                        description: line.description,
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

        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }

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

                const checkCurrentFiscalYrData =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId: customerId,
                                fiscalYearId: currentFiscalYr.id
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!checkCurrentFiscalYrData) {
                    throw new BadRequestException('Transaction you are trying to delete, not in current fiscal yr');
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

        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }

        const qb = this.txnRepository
            .createQueryBuilder('txn')
            .leftJoinAndSelect('txn.lines', 'line', 'line.deletedAt IS NULL')
            .leftJoinAndSelect('line.account', 'account', 'account.deletedAt IS NULL AND account.customerId = :customerId', { customerId })
            .leftJoinAndSelect('txn.fiscalYear', 'fy', 'fy.deletedAt IS NULL AND fy.customerId = :customerId', { customerId })
            .where(
                'txn.deletedAt IS NULL AND txn.customerId = :customerId',
                { customerId, },
            )
            .orderBy('txn.createdAt', 'DESC');


        if (!query.fiscalYearId) {
            // qb.andWhere(`txn.fiscal_year_id = :currentFiscalYearId`, { currentFiscalYearId: currentFiscalYr.id });
        } else {
            qb.andWhere(`txn.fiscal_year_id = :currentFiscalYearId`, { currentFiscalYearId: query.fiscalYearId });
        }

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
                'txn.transaction_date::date >= :transactionFrom',
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
                'txn.transaction_date::date <= :transactionTo',
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
        data: UpdateTransactionDto,
        user: User
    ) {

        const {
            reference,
            amount,
            transactionDate,
            lines
        } = data;

        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }

        const customerId = user.userRoles[0].customerId;
        const isValid = this.commonService.isWithinFiscalYear(new Date(transactionDate), currentFiscalYr.startDate, currentFiscalYr.endDate);

        if (!isValid) {
            throw new BadRequestException(`Transaction cannot be updated since the transaction date is beyond current fiscal yr ${currentFiscalYr.name}`);
        }
        this.validateBalance(lines)
        await this.dataSource.transaction(
            async (manager) => {
                const existingTransaction =
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

                if (!existingTransaction) {
                    throw new BadRequestException('Transaction not found to update.');
                }

                const checkCurrentFiscalYrData =
                    await manager.findOne(
                        Transaction,
                        {
                            where: {
                                id: id,
                                deletedAt: IsNull(),
                                customerId,
                                fiscalYearId: currentFiscalYr.id
                            },

                            relations: [
                                'lines',
                            ],
                        },
                    );

                if (!checkCurrentFiscalYrData) {
                    throw new BadRequestException('Transaction you are trying to get, not in current fiscal yr');
                }


                existingTransaction.reference = reference;
                existingTransaction.amount = amount;
                existingTransaction.transactionDate = new Date(transactionDate);
                await manager.save(Transaction, existingTransaction);

                for (const line of lines) {
                    const transactionLine = await manager.findOne(
                        TransactionLine,
                        {
                            where: {
                                deletedAt: IsNull(),
                                id:
                                    line.lineId
                            },
                        },
                    );

                    const account = await manager.findOne(
                        Account,
                        {
                            where: {
                                deletedAt: IsNull(),
                                id: line.accountId,
                                customerId: customerId
                            },
                        },
                    );

                    if (!account) {

                        throw new BadRequestException(
                            'Account not found',
                        );
                    }

                    if (transactionLine) {
                        await manager.update(TransactionLine, line.lineId, { debit: line.debit, credit: line.credit, description: line.description, accountId: line.accountId });
                    } else {
                        const newTransactionLine = manager.create(TransactionLine, {
                            accountId: line.accountId,
                            credit: line.credit,
                            debit: line.debit,
                            description: line.description,
                            transactionId: existingTransaction.id
                        })

                        await manager.save(
                            TransactionLine,
                            newTransactionLine,
                        );
                    }
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
        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }
        const txn =
            await this.txnRepository.findOne({
                where: {
                    id: transactionId,
                    deletedAt: IsNull(),
                    customerId,
                },
                relations: [
                    'lines',
                    'lines.account',
                ],
            });

        if (!txn) {
            throw new BadRequestException('Transaction not found');
        }

        // const checkCurrentFiscalYrData =
        //     await this.txnRepository.findOne({
        //         where: {
        //             id: transactionId,
        //             deletedAt: IsNull(),
        //             customerId,
        //             fiscalYearId: currentFiscalYr.id
        //         },
        //         relations: [
        //             'lines',
        //             'lines.account',
        //         ],
        //     });

        // if (!checkCurrentFiscalYrData) {
        //     throw new BadRequestException('Transaction you are trying to get, not in current fiscal yr');
        // }

        const pdfMappedData = JVPdfDataMapper(user, backendUrl, txn);

        const pdfBuffer = await this.accountPdfService.journalVoucherPdfGenerator(pdfMappedData);
        return pdfBuffer
    }

    async previewTransactionLine(dto: PreviewTransactionLineDto, user: User) {
        const customerId = user.userRoles[0].customerId;
        const { transactionTypeId, amount, description } = dto;
        const txnType = await this.txnTypeRepository.findOne({ where: { id: transactionTypeId, deletedAt: IsNull(), customerId: customerId }, relations: ['rules'] });

        if (!txnType) {
            throw new NotFoundException('Txn type not found');
        }

        const transactionLines =
            await this.generateJournalLines({
                rules: txnType.rules,
                amount: Number(amount),
                description: description,
            });

        return transactionLines;
    }

    private validateBalance(lines: any[]): void {

        for (const line of lines) {
            if (line.credit > 0 && line.debit === 0) {
                continue;
            } else if (line.credit === 0 && line.debit > 0) {
                continue;
            } else {
                throw new BadRequestException(
                    `debit and credit for line ${lines.indexOf(line) + 1} is not equal. Please check`,
                );
            }
        }

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

}