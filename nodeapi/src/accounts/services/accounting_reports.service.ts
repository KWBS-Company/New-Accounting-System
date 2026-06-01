import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { PaginatedResponse } from 'src/common/dto/pagination.dto';
import { AccountReportQuery, ListAccountReportQuery } from '../dto/accounting_reports.dto';
import { Transaction } from '../entities/transactions.entity';
import { AccountType } from '../types/account_types.enum';
import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class AccountReportService {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>,
        @InjectRepository(Transaction)
        private readonly transactionRepository:
            Repository<Transaction>
    ) { }

    async listAllAccountsWithPagination(
        query: ListAccountReportQuery,
        user: User
    ) {

        const customerId = user.userRoles[0].customerId;

        const page =
            query.page ?? 1;

        const pageSize =
            query.pageSize ?? 20;

        const qb =
            this.transactionRepository
                .createQueryBuilder('txn')

                .where(
                    'txn.deletedAt IS NULL AND txn.customerId = :customerId', { customerId }
                )

                .leftJoinAndSelect(
                    'txn.lines',
                    'lines',
                )

                .leftJoinAndSelect(
                    'lines.account',
                    'account',
                )

                .orderBy(
                    'txn.createdAt',
                    'DESC',
                );


        if (query.accountType) {

            qb.andWhere(
                'account.accountType = :accountType',
                {
                    accountType:
                        query.accountType,
                },
            );
        }


        if (query.search) {

            qb.andWhere(
                `
                (
                    account.code ILIKE :search
                    OR
                    account.name ILIKE :search
                )
                `,
                {
                    search:
                        `%${query.search}%`,
                },
            );
        }


        qb.skip(
            (page - 1) * pageSize,
        ).take(pageSize);


        const [data, total] =
            await qb.getManyAndCount();

        return new PaginatedResponse(
            data,
            total,
            page,
            pageSize,
        );
    }


    async generateTrialBalance(
        data: AccountReportQuery,
        user: User
    ) {

        const {
            accountCode,
            accountType,
            transactionFrom,
            transactionTo,
        } = data;

        const customerId = user.userRoles[0].customerId;


        const qb = this.accountRepository
            .createQueryBuilder('a')

            .select([
                'a.id as id',
                'a.name as name',
                'a.code as code',
                'a.accountType as "accountType"',

                'COALESCE(SUM(tl.debit), 0) as total_debit',

                'COALESCE(SUM(tl.credit), 0) as total_credit',
            ])

            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )

            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )

            .where('a.deleted_at IS NULL AND a.customerId = :customerId', { customerId })
            .andWhere('tl.deleted_at IS NULL')
            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId', { customerId });


        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------

        if (accountCode) {

            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }


        // -----------------------------------------
        // FILTER: ACCOUNT TYPE
        // -----------------------------------------

        if (accountType) {

            qb.andWhere(
                'a."accountType" = :accountType',
                {
                    accountType,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------

        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }


        qb.groupBy('a.id')
            .addGroupBy('a.name')
            .addGroupBy('a.code')
            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );


        return await qb.getRawMany();
    }

    async generateProfitAndLossReport(
        data: AccountReportQuery,
        user: User
    ) {

        const {
            accountCode,
            transactionFrom,
            transactionTo,
        } = data;
        const customerId = user.userRoles[0].customerId;


        const qb = this.accountRepository
            .createQueryBuilder('a')

            .select([
                'a.id as id',

                'a.name as name',

                'a.code as code',

                'a.accountType as "accountType"',

                'COALESCE(SUM(tl.debit), 0) as debit',

                'COALESCE(SUM(tl.credit), 0) as credit',
            ])

            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )

            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )

            .where('a.deleted_at IS NULL AND a.customerId = :customerId', { customerId })

            .andWhere('tl.deleted_at IS NULL')

            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId', { customerId })

            .andWhere(
                `a."accountType" IN (
                    :...accountTypes
                )`,
                {
                    accountTypes: [
                        AccountType.REVENUE,
                        AccountType.EXPENSE,
                    ],
                },
            );


        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------

        if (accountCode) {

            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------

        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }


        qb.groupBy('a.id')

            .addGroupBy('a.name')

            .addGroupBy('a.code')

            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );


        const rows =
            await qb.getRawMany();


        // -----------------------------------------
        // CALCULATE BALANCE
        // -----------------------------------------

        const dataWithBalance =
            rows.map((row) => {

                let balance = 0;

                // -----------------------------
                // Revenue
                // credit - debit
                // -----------------------------

                if (
                    row.accountType ===
                    AccountType.REVENUE
                ) {

                    balance =
                        Number(row.credit)
                        -
                        Number(row.debit);
                }

                // -----------------------------
                // Expense
                // debit - credit
                // -----------------------------

                if (
                    row.accountType ===
                    AccountType.EXPENSE
                ) {

                    balance =
                        Number(row.debit)
                        -
                        Number(row.credit);
                }

                return {
                    ...row,
                    balance,
                };
            });


        // -----------------------------------------
        // TOTALS
        // -----------------------------------------

        const totalRevenue =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.REVENUE,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );

        const totalExpense =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.EXPENSE,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );

        const netProfit =
            totalRevenue - totalExpense;


        return {
            items: dataWithBalance,

            summary: {
                totalRevenue,
                totalExpense,
                netProfit,
            },
        };
    }

    async generateBalanceSheetReport(
        data: AccountReportQuery,
        user: User
    ) {

        const {
            accountCode,
            transactionFrom,
            transactionTo,
        } = data;

        const customerId = user.userRoles[0].customerId;

        const qb = this.accountRepository
            .createQueryBuilder('a')

            .select([
                'a.id as id',

                'a.name as name',

                'a.code as code',

                'a.accountType as "accountType"',

                'COALESCE(SUM(tl.debit), 0) as debit',

                'COALESCE(SUM(tl.credit), 0) as credit',
            ])

            .innerJoin(
                'transaction_lines',
                'tl',
                'tl.account_id = a.id',
            )

            .innerJoin(
                'transactions',
                't',
                't.id = tl.transaction_id',
            )

            .where('a.deleted_at IS NULL AND a.customerId = :customerId', { customerId })

            .andWhere('tl.deleted_at IS NULL')

            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId', { customerId })

            .andWhere(
                `a."accountType" IN (
                    :...accountTypes
                )`,
                {
                    accountTypes: [
                        AccountType.ASSET,
                        AccountType.LIABILITY,
                        AccountType.EQUITY,
                    ],
                },
            );


        // -----------------------------------------
        // FILTER: ACCOUNT CODE
        // -----------------------------------------

        if (accountCode) {

            qb.andWhere(
                'a.code ILIKE :accountCode',
                {
                    accountCode:
                        `%${accountCode}%`,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION FROM
        // -----------------------------------------

        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }


        // -----------------------------------------
        // FILTER: TRANSACTION TO
        // -----------------------------------------

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }


        qb.groupBy('a.id')

            .addGroupBy('a.name')

            .addGroupBy('a.code')

            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );


        const rows =
            await qb.getRawMany();


        // -----------------------------------------
        // CALCULATE BALANCE
        // -----------------------------------------

        const dataWithBalance =
            rows.map((row) => {

                let balance = 0;

                // -----------------------------
                // Asset
                // debit - credit
                // -----------------------------

                if (
                    row.accountType ===
                    AccountType.ASSET
                ) {

                    balance =
                        Number(row.debit)
                        -
                        Number(row.credit);
                }

                // -----------------------------
                // Liability / Equity
                // credit - debit
                // -----------------------------

                if (
                    row.accountType ===
                    AccountType.LIABILITY
                    ||
                    row.accountType ===
                    AccountType.EQUITY
                ) {

                    balance =
                        Number(row.credit)
                        -
                        Number(row.debit);
                }

                return {
                    ...row,
                    balance,
                };
            });


        // -----------------------------------------
        // TOTALS
        // -----------------------------------------

        const totalAssets =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.ASSET,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );

        const totalLiabilities =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.LIABILITY,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );

        const totalEquity =
            dataWithBalance
                .filter(
                    (x) =>
                        x.accountType ===
                        AccountType.EQUITY,
                )
                .reduce(
                    (sum, x) =>
                        sum + Number(x.balance),
                    0,
                );


        return {
            items: dataWithBalance,

            summary: {
                totalAssets,
                totalLiabilities,
                totalEquity,

                totalLiabilitiesAndEquity:
                    totalLiabilities +
                    totalEquity,
            },
        };
    }
}
