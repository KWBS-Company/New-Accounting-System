import { CompanyInfo, FiscalYear } from "./account_company.types";
import { AccountType } from "./account_types.enum";

export interface ProfitLossItem {
    id: string;
    name: string;
    code: string;
    accountType: AccountType;
    debit: number;
    credit: number;
    balance: number;
}


export interface ProfitLossData {
    items: ProfitLossItem[];
    summary: ProfitLossSummary;
}

export interface ProfitLossSummary {
    totalRevenue: number;
    totalExpense: number;
    netProfit: number;
}


// pdf

export interface PLLineItem {
    code: string;
    name: string;
    accountType: string;
    balance: number;
}

export interface PLSummary {
    totalRevenue: number;
    totalExpense: number;
    netProfitAbs: number;
}

export interface ProfitLossPDFData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    revenues: PLLineItem[];
    expenses: PLLineItem[];
    summary: PLSummary;
    isProfit: boolean;
}