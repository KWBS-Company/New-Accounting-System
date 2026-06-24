import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountReportQuery } from '../dto/accounting_reports.dto';
import { AccountType } from '../types/account_types.enum';
import { User } from 'src/auth/entities/user.entity';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';

@Injectable()
export class AccountReportService {
    constructor(
        @InjectRepository(Account)
        private readonly accountRepository: Repository<Account>
    ) { }


    private async trialBalanceRawData(accountReportQuery: AccountReportQuery, customerId: string) {
        const {
            transactionFrom,
            transactionTo,
            fiscalYearId,
            accountCode,
            accountType
        } = accountReportQuery;

        const qb = this.accountRepository
            .createQueryBuilder('a')

            .select([
                'a.id as id',
                'a.name as name',
                'a.code as code',
                'a.accountType as "accountType"',

                'COALESCE(SUM(tl.debit), 0) as "debit"',

                'COALESCE(SUM(tl.credit), 0) as "credit"',
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


        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date::date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date::date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }

        if (accountCode) {

            qb.andWhere(
                'a.code = :accountCode',
                {
                    accountCode,
                },
            );
        }

        if (accountType) {

            qb.andWhere(
                'a.accountType = :accountType',
                {
                    accountType,
                },
            );
        }

        if (fiscalYearId) {
            qb.andWhere(`t.fiscal_year_id = :currentFiscalYearId`, { currentFiscalYearId: fiscalYearId });
        }


        qb.groupBy('a.id')
            .addGroupBy('a.name')
            .addGroupBy('a.code')
            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );


        const rows = await qb.getRawMany<{ id: string; name: string; code: string; accountType: AccountType, debit: number; credit: number }>();
        return rows;
    }

    private async profitAndLossRawData(accountReportQuery: AccountReportQuery, customerId: string) {
        const {
            transactionFrom,
            transactionTo,
            fiscalYearId
        } = accountReportQuery;

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

        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date::date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date::date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }

        if (fiscalYearId) {
            qb.andWhere(`t.fiscal_year_id = :currentFiscalYearId`, { currentFiscalYearId: fiscalYearId });
        }


        qb.groupBy('a.id')

            .addGroupBy('a.name')

            .addGroupBy('a.code')

            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );


        const rows = await qb.getRawMany<{ id: string; name: string; code: string; accountType: AccountType, debit: number; credit: number }>();
        return rows;

    }

    private async balanceSheetRawData(accountReportQuery: AccountReportQuery, customerId: string) {
        const {
            transactionFrom,
            transactionTo,
            fiscalYearId
        } = accountReportQuery;
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

        if (transactionFrom) {

            qb.andWhere(
                't.transaction_date::date >= :transactionFrom',
                {
                    transactionFrom,
                },
            );
        }

        if (transactionTo) {

            qb.andWhere(
                't.transaction_date::date <= :transactionTo',
                {
                    transactionTo,
                },
            );
        }

        if (fiscalYearId) {
            qb.andWhere(`t.fiscal_year_id = :currentFiscalYearId`, { currentFiscalYearId: fiscalYearId });
        }


        qb.groupBy('a.id')

            .addGroupBy('a.name')

            .addGroupBy('a.code')

            .addGroupBy('a."accountType"')

            .orderBy(
                'LOWER(a.name)',
                'ASC',
            );

        const rows = await qb.getRawMany<{ id: string; name: string; code: string; accountType: AccountType, debit: number; credit: number }>();

        return rows;
    }

    async generateTrialBalance(
        accountReportQuery: AccountReportQuery,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;
        const rows = await this.trialBalanceRawData(accountReportQuery, customerId);

        const dataWithBalance =
            rows.map((row) => {
                const balance = Number(row.debit) - Number(row.credit);
                return {
                    ...row,
                    balance,
                };
            });

        const totalDebit = dataWithBalance.reduce((prev, curr) => prev + Number(curr.debit), 0);
        const totalCredit = dataWithBalance.reduce((prev, curr) => prev + Number(curr.credit), 0);
        return { items: dataWithBalance, summary: { totalCredit, totalDebit } };
    }

    async generateProfitAndLossReport(
        accountReportQuery: AccountReportQuery,
        user: User,
    ) {
        const customerId = user.userRoles[0].customerId;
        const rows = await this.profitAndLossRawData(accountReportQuery, customerId);
        const dataWithBalance =
            rows.map((row) => {
                let balance = 0;
                if (row.accountType === AccountType.REVENUE) {
                    balance = Number(row.credit) - Number(row.debit);
                }
                if (row.accountType === AccountType.EXPENSE) {
                    balance = Number(row.debit) - Number(row.credit);
                }

                return {
                    ...row,
                    balance,
                };
            });

        const totalRevenue = dataWithBalance.filter((x) => x.accountType === AccountType.REVENUE).reduce((sum, x) => sum + Number(x.balance), 0);
        const totalExpense = dataWithBalance.filter((x) => x.accountType === AccountType.EXPENSE).reduce((sum, x) => sum + Number(x.balance), 0);
        const netProfit = totalRevenue - totalExpense;
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
        accountReportQuery: AccountReportQuery,
        user: User
    ) {

        const customerId = user.userRoles[0].customerId;
        const rows = await this.balanceSheetRawData(accountReportQuery, customerId);
        const plReport = await this.generateProfitAndLossReport(accountReportQuery, user);
        const dataWithBalance =
            rows.map((row) => {

                let balance = 0;
                if (row.accountType === AccountType.ASSET) {
                    balance = Number(row.debit) - Number(row.credit);
                }

                if (row.accountType === AccountType.LIABILITY || row.accountType === AccountType.EQUITY) {
                    balance = Number(row.credit) - Number(row.debit);
                }

                return {
                    ...row,
                    balance,
                };
            });

        const totalAssets = dataWithBalance.filter((x) => x.accountType === AccountType.ASSET).reduce((sum, x) => sum + Number(x.balance), 0);

        const totalLiabilities = dataWithBalance.filter((x) => x.accountType === AccountType.LIABILITY).reduce((sum, x) => sum + Number(x.balance), 0);

        const totalEquity = dataWithBalance.filter((x) => x.accountType === AccountType.EQUITY).reduce((sum, x) => sum + Number(x.balance), 0);

        return {
            items: dataWithBalance,
            summary: {
                totalAssets,
                totalLiabilities,
                totalEquity: totalEquity + plReport.summary.netProfit,
                totalLiabilitiesAndEquity: totalLiabilities + totalEquity + plReport.summary.netProfit,
                currentYearNetPL: plReport.summary.netProfit,
            },
        };
    }
}
