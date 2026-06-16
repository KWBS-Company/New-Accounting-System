import { User } from "src/auth/entities/user.entity";
import { AccountType } from "../types/account_types.enum";
import { AccountRow, BalanceSheetData, CompanyInfo, FiscalYear, JournalVoucherData, LedgerAccount, LedgerData, ProfitLossData, Totals, TrialBalanceData } from "../types/pdf_data.types";
import { Transaction } from "../entities/transactions.entity";
import { FiscalYearStatus } from "src/customer/types/fiscal_years.status.types";
import { BadRequestException } from "@nestjs/common";
import { TransactionLine } from "../entities/transaction_lines.entity";
import { Account } from "../entities/accounts.entity";

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
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
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
            start: new Date(currentFiscalYr.startDate).toLocaleDateString(),
            end: new Date(currentFiscalYr.endDate).toLocaleDateString()
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
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
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

export const JVPdfDataMapper = (user: User, backendUrl: string, txnData: Transaction) => {

    const totalDebit = txnData.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = txnData.lines.reduce((s, l) => s + Number(l.credit), 0);
    const company = user.userRoles[0].customer;
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
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
            transactionType: { name: txnData.lines[0].description },
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

export const BSPdfDataMapper = (user: User, backendUrl: string, bs: {
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
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
        totalLiabilitiesAndEquity: number;
        currentYearNetPL: number;
    };
}) => {
    const company = user.userRoles[0].customer;
    const equities = bs.items.filter(it => it.accountType === AccountType.EQUITY);
    const assets = bs.items.filter(it => it.accountType === AccountType.ASSET);
    const liabilities = bs.items.filter(it => it.accountType === AccountType.LIABILITY);
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const context: BalanceSheetData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo ? `${backendUrl}${company.companyLogo}` : undefined,
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
        equity: equities,
        liabilities,
        assets,
        summary: bs.summary,
        currency: company.transactionCurrencyCode,
        isBalanced: bs.summary.totalAssets === bs.summary.totalLiabilitiesAndEquity
    }

    return context;
}


export const ledgerPdfDataMapper = (user: User, backendUrl: string, account: Account) => {
    const company = user.userRoles[0].customer;
    const currentFiscalYr = company.fiscalYears.find(fy => fy.status === FiscalYearStatus.OPEN);
    if (!currentFiscalYr) {
        throw new BadRequestException('Fiscal year has not been set up yet');
    }
    const context: LedgerData = {
        company: {
            name: company.companyName,
            logoImage: company.companyLogo ? `${backendUrl}${company.companyLogo}` : undefined,
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
        fromDate: new Date(currentFiscalYr.startDate).toLocaleDateString(),
        toDate: new Date(currentFiscalYr.endDate).toLocaleDateString(),
        currency: company.transactionCurrencyCode,
        account: {
            id: account.id,
            name: account.name,
            code: account.code,
            accountType: account.accountType,
            openingBalance: 0,
            lines: account.lines.map(l => ({
                id: l.id,
                transactionId: l.transactionId,
                // Support both flat join and nested transaction object
                transactionDate: l.transaction.transactionDate.toDateString() ?? "",
                serialNumber: l.transaction.serialNumber.toString() ?? "-",
                debit: l.debit,
                credit: l.credit,
                description: l.description,
            }))
        }
    }

    return context;
}