import { CompanyInfo, FiscalYear } from './account_company.types';
import { AccountType } from './account_types.enum';

export interface BalanceSheetItem {
    id: string;
    name: string;
    code: string;
    accountType: AccountType;
    debit: number;
    credit: number;
    balance: number;
}

export interface BalanceSheetSummary {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    currentYearNetPL: number;
}

export interface BalanceSheetData {
    items: BalanceSheetItem[];
    summary: BalanceSheetSummary;
}

// pdf

export interface BSLineItem {
    code: string;
    name: string;
    accountType: string;
    balance: number;
}

export interface BSSummary {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    totalLiabilitiesAndEquity: number;
    currentYearNetPL: number;
}

export interface BalanceSheetPDFData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    assets: BSLineItem[];
    liabilities: BSLineItem[];
    equity: BSLineItem[];
    summary: BSSummary;
    isBalanced: boolean;
}
