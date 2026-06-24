import { CompanyInfo, FiscalYear } from "./account_company.types";
import { AccountType } from "./account_types.enum";


export interface LedgerLine {
    transactionDate: string;
    fiscalYear: string;
    fiscalYearId: string;
    startDate: string;
    endDate: string;
    debit: number;
    credit: number;
    balance: number
    serialNumber: number
    description: string;
}

export interface LedgerSummary {
    openingBalance: number;
    totalBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
}

export interface LedgerData {
    ledger: LedgerBasic;
    summary: LedgerSummary;
    lines: LedgerLine[];
}

export interface LedgerBasic {
    id: string;
    name: string;
    accountType: AccountType;
    code: string;
}


// pdf
export interface LedgerPDFData {
    company: CompanyInfo;
    fiscalYear: FiscalYear;
    reportDate: string;
    fromDate: string;
    toDate: string;
    currency: string;
    summary: LedgerSummary;
    lines: LedgerLine[];
    ledger: LedgerBasic;
}