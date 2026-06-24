import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Account } from '../entities/accounts.entity';
import { AccountReportQuery } from '../dto/accounting_reports.dto';
import { AccountType } from '../types/account_types.enum';
import { User } from 'src/auth/entities/user.entity';
import { TrialBalanceItem } from '../types/trial_balance.types';
import { ProfitLossItem } from '../types/profit_loss.types';
import { BalanceSheetItem } from '../types/balance_sheet.types';
import { trialBalanceDataMapper } from '../mapper/trial_balance.data.mapper';
import { profitLossDataMapper } from '../mapper/profit_loss.data.mapper';
import { balanceSheetDataMapper } from '../mapper/balance_sheet.data.mapper';

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


        const rows = await qb.getRawMany<TrialBalanceItem>();
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


        const rows = await qb.getRawMany<ProfitLossItem>();
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

        const rows = await qb.getRawMany<BalanceSheetItem>();

        return rows;
    }

    async generateTrialBalance(
        accountReportQuery: AccountReportQuery,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;
        const trialBalanceItems = await this.trialBalanceRawData(accountReportQuery, customerId);
        return trialBalanceDataMapper(trialBalanceItems);
    }

    async generateProfitAndLossReport(
        accountReportQuery: AccountReportQuery,
        user: User,
    ) {
        const customerId = user.userRoles[0].customerId;
        const profitLossItems = await this.profitAndLossRawData(accountReportQuery, customerId);
        return profitLossDataMapper(profitLossItems)
    }

    async generateBalanceSheetReport(
        accountReportQuery: AccountReportQuery,
        user: User
    ) {
        const customerId = user.userRoles[0].customerId;
        const balanceSheetItems = await this.balanceSheetRawData(accountReportQuery, customerId);
        const profitLossData = await this.generateProfitAndLossReport(accountReportQuery, user);
        return balanceSheetDataMapper(balanceSheetItems, profitLossData);
    }
}
