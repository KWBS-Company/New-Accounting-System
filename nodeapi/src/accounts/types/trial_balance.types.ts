import { CompanyInfo, FiscalYear } from "./account_company.types";
import { AccountType } from "./account_types.enum";

export interface TrialBalanceItem {
    id: string;
    name: string;
    code: string;
    accountType: AccountType;
    debit: number;
    credit: number;
    balance: number;
}

export interface TrialBalanceSummary {
    totalDebit: number;
    totalCredit: number;
}


export interface TrialBalanceData {
    items: TrialBalanceItem[];
    summary: TrialBalanceSummary
}


//  for pdf
export interface AccountRow {
    code: string;
    name: string;
    balance: string;
    accountType: string;
    debit: string;
    credit: string;
}

export interface Totals {
    debit: string;
    credit: string;
}

export interface TrialBalancePDFData {
    company: CompanyInfo;
    fiscalYear?: FiscalYear;
    reportDate: string;
    asOf: string;
    currency?: string;
    accounts: AccountRow[];
    totals: Totals;
    isMatched: boolean;
}