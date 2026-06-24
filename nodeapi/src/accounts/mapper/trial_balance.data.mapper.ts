import { FiscalYearStatus } from "src/customer/types/fiscal_years.status.types";
import { TrialBalanceData, TrialBalanceItem, TrialBalancePDFData, TrialBalanceSummary } from "../types/trial_balance.types";
import { User } from "src/auth/entities/user.entity";
import { BadRequestException } from "@nestjs/common";

export const trialBalanceDataMapper = (rows: TrialBalanceItem[]) => {
    const dataWithBalance =
        rows.map((row) => {
            const balance = Number(row.debit) - Number(row.credit);
            return {
                ...row,
                balance,
            };
        }) as TrialBalanceItem[];

    const totalDebit = dataWithBalance.reduce((prev, curr) => prev + Number(curr.debit), 0);
    const totalCredit = dataWithBalance.reduce((prev, curr) => prev + Number(curr.credit), 0);
    return { items: dataWithBalance, summary: { totalCredit, totalDebit } as TrialBalanceSummary };
}


export const trialBalancePdfDataMapper = (user: User, backendUrl: string, trialBalance: TrialBalanceData) => {
    const company = user.userRoles[0].customer;
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const data: TrialBalancePDFData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo ? `${backendUrl}${company.companyLogo}` : undefined,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber
        },
        fiscalYear: {
            start: new Date(currentFiscalYr.startDate).toLocaleDateString(),
            end: new Date(currentFiscalYr.endDate).toLocaleDateString()
        },
        reportDate: new Date().toLocaleDateString(),
        asOf: new Date().toLocaleDateString(),
        accounts: trialBalance.items.map(tb => ({ ...tb, debit: tb.debit.toString(), credit: tb.credit.toString(), balance: tb.balance.toString() })),
        totals: {
            debit: trialBalance.summary.totalDebit.toString(),
            credit: trialBalance.summary.totalCredit.toString()
        },
        currency: company.transactionCurrencyCode,
        isMatched: trialBalance.summary.totalDebit === trialBalance.summary.totalCredit
    }

    return data;
}