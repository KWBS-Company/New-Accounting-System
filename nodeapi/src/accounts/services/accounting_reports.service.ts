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


    private async trialBalanceRawData(accountReportQuery: AccountReportQuery, customerId: string, currentFiscalYearId: string) {
        const {
            transactionFrom,
            transactionTo,
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
            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId AND t.fiscal_year_id = :currentFiscalYearId ', { customerId, currentFiscalYearId });


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

    private async profitAndLossRawData(accountReportQuery: AccountReportQuery, customerId: string, currentFiscalYearId: string) {
        const {
            transactionFrom,
            transactionTo,
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

            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId AND t.fiscal_year_id = :currentFiscalYearId', { customerId, currentFiscalYearId })

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

    private async balanceSheetRawData(accountReportQuery: AccountReportQuery, customerId: string, currentFiscalYearId: string) {
        const {
            transactionFrom,
            transactionTo,
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

            .andWhere('t.deleted_at IS NULL AND t.customerId = :customerId AND t.fiscal_year_id = :currentFiscalYearId', { customerId, currentFiscalYearId })

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
        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }
        const rows = await this.trialBalanceRawData(accountReportQuery, customerId, currentFiscalYr.id);

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
        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }
        const rows = await this.profitAndLossRawData(accountReportQuery, customerId, currentFiscalYr.id);
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
        const currentFiscalYr = user.userRoles[0].customer.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);

        if (!currentFiscalYr) {
            throw new BadRequestException('Fiscal yr has not been set yet');
        }
        const rows = await this.balanceSheetRawData(accountReportQuery, customerId, currentFiscalYr.id);
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
