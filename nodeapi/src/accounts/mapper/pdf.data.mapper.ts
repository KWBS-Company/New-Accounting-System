import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";
import { AccountRow, CompanyInfo, FiscalYear, Totals, TrialBalanceData } from "../types/account_report.types";

export const trialBalancePdfDataMapper = (user: User, backendUrl: string, trialBalance: {
    items: {
        balance: number;
        id: string;
        name: string;
        code: string;
        accountType: AccountType;
        debit: number;
        credit: number;
    }[];
    summary: {
        totalCredit: number;
        totalDebit: number;
    };
}) => {
    const company = user.userRoles[0].customer;
    const data: TrialBalanceData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo ? `${backendUrl}${company.companyLogo}` : undefined,
            phone: company.companyPhone,
            email: company.companyEmail,
            website: company.companyWebsite,
            address: company.companyAddress,
            panNumber: company.panNumber,
            vatNumber: company.vatNumber
        } as CompanyInfo,
        fiscalYear: {
            start: new Date(company.fiscalStartDate).toLocaleDateString(),
            end: new Date(company.fiscalEndDate).toLocaleDateString()
        } as FiscalYear,
        reportDate: new Date().toLocaleDateString(),
        asOf: new Date().toLocaleDateString(),
        accounts: trialBalance.items.map(tb => ({ ...tb, debit: tb.debit.toString(), credit: tb.credit.toString(), balance: tb.balance.toString() })) as AccountRow[],
        totals: {
            debit: trialBalance.summary.totalDebit.toString(),
            credit: trialBalance.summary.totalCredit.toString()
        } as Totals,
        currency: company.transactionCurrencyCode,
        isMatched: trialBalance.summary.totalDebit === trialBalance.summary.totalCredit
    }

    return data;
}