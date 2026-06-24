import { User } from 'src/auth/entities/user.entity';
import { AccountType } from '../types/account_types.enum';
import {
    BalanceSheetData,
    BalanceSheetItem,
    BalanceSheetPDFData,
} from '../types/balance_sheet.types';
import { ProfitLossData } from '../types/profit_loss.types';
import { FiscalYearStatus } from 'src/customer/types/fiscal_years.status.types';
import { BadRequestException } from '@nestjs/common';

export const balanceSheetDataMapper = (
    rows: BalanceSheetItem[],
    profitLossData: ProfitLossData,
): BalanceSheetData => {
    const dataWithBalance = rows.map((row) => {
        let balance = 0;
        if (row.accountType === AccountType.ASSET) {
            balance = Number(row.debit) - Number(row.credit);
        }

        if (
            row.accountType === AccountType.LIABILITY ||
            row.accountType === AccountType.EQUITY
        ) {
            balance = Number(row.credit) - Number(row.debit);
        }

        return {
            ...row,
            balance,
        };
    });

    const totalAssets = dataWithBalance
        .filter((x) => x.accountType === AccountType.ASSET)
        .reduce((sum, x) => sum + Number(x.balance), 0);

    const totalLiabilities = dataWithBalance
        .filter((x) => x.accountType === AccountType.LIABILITY)
        .reduce((sum, x) => sum + Number(x.balance), 0);

    const totalEquity = dataWithBalance
        .filter((x) => x.accountType === AccountType.EQUITY)
        .reduce((sum, x) => sum + Number(x.balance), 0);

    return {
        items: dataWithBalance,
        summary: {
            totalAssets,
            totalLiabilities,
            totalEquity: totalEquity + profitLossData.summary.netProfit,
            totalLiabilitiesAndEquity:
                totalLiabilities +
                totalEquity +
                profitLossData.summary.netProfit,
            currentYearNetPL: profitLossData.summary.netProfit,
        },
    };
};

export const BSPdfDataMapper = (
    user: User,
    backendUrl: string,
    bs: BalanceSheetData,
) => {
    const company = user.userRoles[0].customer;
    const equities = bs.items.filter(
        (it) => it.accountType === AccountType.EQUITY,
    );
    const assets = bs.items.filter(
        (it) => it.accountType === AccountType.ASSET,
    );
    const liabilities = bs.items.filter(
        (it) => it.accountType === AccountType.LIABILITY,
    );
    const currentFiscalYr = company.fiscalYears.find(
        (fy) => fy.status === FiscalYearStatus.OPEN,
    );
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const context: BalanceSheetPDFData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo
                ? `${backendUrl}${company.companyLogo}`
                : undefined,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber,
        },
        fiscalYear: {
            start: new Date(currentFiscalYr.startDate).toLocaleDateString(),
            end: new Date(currentFiscalYr.endDate).toLocaleDateString(),
        },
        reportDate: new Date().toLocaleDateString(),
        asOf: new Date().toLocaleDateString(),
        equity: equities,
        liabilities,
        assets,
        summary: bs.summary,
        currency: company.transactionCurrencyCode,
        isBalanced:
            bs.summary.totalAssets === bs.summary.totalLiabilitiesAndEquity,
    };

    return context;
};
