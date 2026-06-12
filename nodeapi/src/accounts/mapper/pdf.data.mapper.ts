import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";
import { AccountRow, CompanyInfo, FiscalYear, JournalVoucherData, ProfitLossData, Totals, TrialBalanceData } from "../types/account_report.types";
import { Transaction } from "../entities/transactions.entity";

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

export const PLPdfDataMapper = (user: User, backendUrl: string, pl: {
    items: any[];
    summary: {
        totalRevenue: any;
        totalExpense: any;
        netProfit: number;
    };
}) => {
    const company = user.userRoles[0].customer;
    const revenues = pl.items.filter(it => it.accountType === AccountType.REVENUE);
    const expenses = pl.items.filter(it => it.accountType === AccountType.EXPENSE);
    const data: ProfitLossData = {
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
            start: new Date(company.fiscalStartDate).toLocaleDateString(),
            end: new Date(company.fiscalEndDate).toLocaleDateString()
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

export const JVPdfDataMapper = (user: User, backendUrl: string, txnData: Transaction) => {

    const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
    const company = user.userRoles[0].customer;
    const context: JournalVoucherData = {
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
        txn: {
            serialNumber: txnData.serialNumber.toString(),
            transactionDate: txnData.transactionDate.toDateString(),   // ISO date string e.g. "2024-12-31"
            reference: txnData.reference,
            transactionType: { name: txnData.transactionType.name },
            lines: txnData.lines.map(l => ({
                account: { name: l.account.name },
                description: l.description,
                debit: l.debit,
                credit: l.credit
            })),
            totalDebit: totalDebit,
            totalCredit: totalCredit,
            isBalanced: totalDebit === totalCredit,
        },
    };
    return context;
}