import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";
import { ProfitLossData, ProfitLossItem, ProfitLossPDFData } from "../types/profit_loss.types";
import { BadRequestException } from "@nestjs/common";
import { FiscalYearStatus } from "src/customer/types/fiscal_years.status.types";

export const profitLossDataMapper = (rows: ProfitLossItem[]): ProfitLossData => {
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

export const PLPdfDataMapper = (user: User, backendUrl: string, pl: ProfitLossData) => {
    const company = user.userRoles[0].customer;
    const revenues = pl.items.filter(it => it.accountType === AccountType.REVENUE);
    const expenses = pl.items.filter(it => it.accountType === AccountType.EXPENSE);
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const data: ProfitLossPDFData = {
        company: {
            logoImage: company.companyLogo ? `${backendUrl}${company.companyLogo}` : undefined,
            name: company.companyName,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber,
        },
        fiscalYear: {
            start: new Date(currentFiscalYr.startDate).toLocaleDateString(),
            end: new Date(currentFiscalYr.endDate).toLocaleDateString()
        },
        reportDate: new Date().toLocaleDateString(),
        asOf: new Date().toLocaleDateString(),
        revenues,
        expenses,
        summary: {
            ...pl.summary, netProfitAbs: Math.abs(pl.summary.netProfit)
        },
        currency: company.transactionCurrencyCode,
        isProfit: pl.summary.netProfit >= 0,
    }

    return data;
}